import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { useInvalidate } from '../lib/hooks';
import { lineReady, ROLE_INFO } from '../lib/format';
import { FoodListItem, FoodRef, IngredientLine, IngredientRole, Paged } from '../lib/types';
import { ErrorBox } from './ui';

const ROLES = Object.keys(ROLE_INFO) as IngredientRole[];
const needsFoodstuff = (r: IngredientRole) => r === 'CORE' || r === 'SEASONING';

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
          <li key={f.id}><button className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => onPick({ id: f.id, code: f.code, name: f.name })}>{f.name} <span className="text-xs text-slate-400">{f.code}</span></button></li>
        ))}
        {data && data.items.length === 0 && <li className="px-2 py-1 text-slate-500">No matches.</li>}
      </ul>
    </div>
  );
}

/**
 * Each ingredient line needs two things confirmed before a dish can go live: which foodstuffs it refers to, and
 * how much it matters (its role). The public app matches on exactly this, so suggestions stay "Suggested" until a person confirms.
 */
export function IngredientLines({ dishId, lines, canEdit }: { dishId: string; lines: IngredientLine[]; canEdit: boolean }) {
  const invalidate = useInvalidate();
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const patch = useMutation({
    mutationFn: (v: { lineId: string; body: Record<string, unknown> }) => api(`/admin/dishes/${dishId}/ingredients/${v.lineId}`, { method: 'PATCH', body: v.body }),
    onSuccess: async () => { setPickerFor(null); setResult(null); await invalidate(); },
  });
  const confirmAll = useMutation({
    mutationFn: () => api<{ confirmed: number; needAttention: number }>(`/admin/dishes/${dishId}/ingredients/confirm-all`, { method: 'POST' }),
    onSuccess: async (r) => {
      setResult(r.needAttention > 0 ? `Confirmed ${r.confirmed}. ${r.needAttention} line${r.needAttention === 1 ? '' : 's'} still need a foodstuff or a different role.` : `Confirmed ${r.confirmed}. Every line is ready.`);
      await invalidate();
    },
  });

  const pending = lines.filter((l) => !lineReady(l));

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Ingredients</h2>
          <p className="text-xs text-slate-500">Check what each line refers to and how much it matters. A dish can only go live when every line is confirmed.</p>
        </div>
        {canEdit && pending.length > 0 && (
          <button className="btn-secondary" disabled={confirmAll.isPending} onClick={() => confirmAll.mutate()}>Confirm all that are ready to confirm</button>
        )}
      </div>
      {result && <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">{result}</p>}
      <details className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer select-none font-medium">What do the roles mean?</summary>
        <ul className="mt-2 space-y-1">{ROLES.map((r) => <li key={r}><span className="font-medium">{ROLE_INFO[r].label}:</span> {ROLE_INFO[r].help}</li>)}</ul>
      </details>
      <ul className="divide-y divide-slate-100">
        {lines.map((l) => {
          const ready = lineReady(l);
          const blocked = needsFoodstuff(l.role) && l.foods.length === 0;
          return (
            <li key={l.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 break-words">{l.rawText}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${ready ? 'bg-emerald-100 text-emerald-800' : l.mappingStatus === 'UNMAPPED' && l.foods.length === 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                  {ready ? 'Confirmed' : l.foods.length === 0 && needsFoodstuff(l.role) ? 'Needs a foodstuff' : 'Suggested'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {l.foods.map((f) => (
                  <span key={f.id} className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    {f.name}
                    {canEdit && <button title="Unlink" aria-label={`Unlink ${f.name}`} className="px-0.5 text-brand-700 hover:text-red-600" onClick={() => patch.mutate({ lineId: l.id, body: { foodIds: l.foods.filter((x) => x.id !== f.id).map((x) => x.id), mappingStatus: 'UNMAPPED' } })}>×</button>}
                  </span>
                ))}
                {canEdit && <button className="py-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => setPickerFor(pickerFor === l.id ? null : l.id)}>+ Add foodstuff</button>}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  Role
                  <select className="input w-auto py-1 text-sm" value={l.role} disabled={!canEdit || patch.isPending} onChange={(e) => patch.mutate({ lineId: l.id, body: { role: e.target.value } })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                  </select>
                </label>
                {!l.roleConfirmed && <span className="text-xs text-amber-700">role suggested</span>}
                {blocked && <span className="text-xs text-red-700">link a foodstuff, or change the role</span>}
                {canEdit && !ready && (
                  <button
                    className="btn-secondary py-1 text-xs" disabled={blocked || patch.isPending}
                    title={blocked ? 'Link a foodstuff first, or set the role to Staple or Optional if none applies' : undefined}
                    onClick={() => patch.mutate({ lineId: l.id, body: { foodIds: l.foods.map((f) => f.id), mappingStatus: 'CONFIRMED', roleConfirmed: true } })}
                  >
                    Confirm{!blocked && l.foods.length === 0 ? ' (no foodstuff needed)' : ''}
                  </button>
                )}
              </div>

              {!l.roleConfirmed && /,|\+/.test(l.rawText) && l.role !== 'CORE' && (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Several items on this line. Check that “{ROLE_INFO[l.role].label}” fits all of them; if one item is a core ingredient, set the role to Core.
                </p>
              )}

              {pickerFor === l.id && <FoodPicker onClose={() => setPickerFor(null)} onPick={(f) => patch.mutate({ lineId: l.id, body: { foodIds: [...l.foods.map((x) => x.id), f.id], mappingStatus: 'AUTO_SUGGESTED' } })} />}
            </li>
          );
        })}
      </ul>
      {(patch.error || confirmAll.error) && <div className="p-3"><ErrorBox error={patch.error ?? confirmAll.error} /></div>}
    </section>
  );
}
