import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { useInvalidate } from '../lib/hooks';
import { FoodRef, IngredientLine, Paged, FoodListItem } from '../lib/types';
import { ErrorBox } from './ui';

const STATUS_STYLE = {
  UNMAPPED: 'bg-slate-100 text-slate-600', AUTO_SUGGESTED: 'bg-amber-100 text-amber-800', CONFIRMED: 'bg-emerald-100 text-emerald-800',
} as const;
const STATUS_TEXT = { UNMAPPED: 'Not mapped', AUTO_SUGGESTED: 'Suggested', CONFIRMED: 'Confirmed' } as const;

function FoodPicker({ onPick, onClose }: { onPick: (f: FoodRef) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { data } = useQuery({
    queryKey: ['foods', 'picker', q],
    queryFn: () => api<Paged<FoodListItem>>('/admin/foods' + qs({ q, pageSize: 8 })),
    enabled: q.trim().length >= 2,
  });
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex gap-2">
        <input autoFocus className="input" placeholder="Search foodstuffs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
      <ul className="mt-2 max-h-48 overflow-y-auto text-sm">
        {data?.items.map((f) => (
          <li key={f.id}><button className="w-full rounded px-2 py-1 text-left hover:bg-slate-100" onClick={() => onPick({ id: f.id, code: f.code, name: f.name })}>{f.name} <span className="text-xs text-slate-400">{f.code}</span></button></li>
        ))}
        {data && data.items.length === 0 && <li className="px-2 py-1 text-slate-500">No matches.</li>}
      </ul>
    </div>
  );
}

/** Links each free-text ingredient line to foodstuffs. Auto-suggestions stay "Suggested" until someone confirms. */
export function IngredientLines({ dishId, lines, canEdit }: { dishId: string; lines: IngredientLine[]; canEdit: boolean }) {
  const invalidate = useInvalidate();
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const patch = useMutation({
    mutationFn: (v: { lineId: string; foodIds: string[]; confirm?: boolean }) =>
      api(`/admin/dishes/${dishId}/ingredients/${v.lineId}`, { method: 'PATCH', body: { foodIds: v.foodIds, ...(v.confirm ? { mappingStatus: 'CONFIRMED' } : {}) } }),
    onSuccess: async () => { setPickerFor(null); await invalidate(); },
  });

  const confirmable = lines.filter((l) => l.mappingStatus === 'AUTO_SUGGESTED');
  const confirmAll = async () => {
    for (const l of confirmable) await patch.mutateAsync({ lineId: l.id, foodIds: l.foods.map((f) => f.id), confirm: true });
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Ingredients</h2>
          <p className="text-xs text-slate-500">Link each line to the foodstuffs it uses. This is what nutrient calculation will rely on.</p>
        </div>
        {canEdit && confirmable.length > 0 && <button className="btn-secondary" disabled={patch.isPending} onClick={confirmAll}>Confirm all {confirmable.length} suggestions</button>}
      </div>
      <ul className="divide-y divide-slate-100">
        {lines.map((l) => (
          <li key={l.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <p className={`min-w-0 break-words ${l.optional ? 'text-slate-600' : ''}`}>{l.rawText}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[l.mappingStatus]}`}>{STATUS_TEXT[l.mappingStatus]}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {l.foods.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                  {f.name}
                  {canEdit && <button title="Unlink" className="text-brand-700 hover:text-red-600" onClick={() => patch.mutate({ lineId: l.id, foodIds: l.foods.filter((x) => x.id !== f.id).map((x) => x.id) })}>×</button>}
                </span>
              ))}
              {canEdit && <button className="py-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => setPickerFor(pickerFor === l.id ? null : l.id)}>+ Add foodstuff</button>}
              {canEdit && l.mappingStatus === 'AUTO_SUGGESTED' && (
                <button className="py-1 text-xs font-medium text-emerald-700 hover:underline" onClick={() => patch.mutate({ lineId: l.id, foodIds: l.foods.map((f) => f.id), confirm: true })}>Confirm</button>
              )}
            </div>
            {pickerFor === l.id && <FoodPicker onClose={() => setPickerFor(null)} onPick={(f) => patch.mutate({ lineId: l.id, foodIds: [...l.foods.map((x) => x.id), f.id] })} />}
          </li>
        ))}
      </ul>
      {patch.error && <div className="p-3"><ErrorBox error={patch.error} /></div>}
    </section>
  );
}
