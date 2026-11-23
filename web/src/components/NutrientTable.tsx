import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useInvalidate } from '../lib/hooks';
import { FoodNutrientValue, Nutrient, Source } from '../lib/types';
import { titleCase } from '../lib/format';
import { describeError } from '../lib/errors';
import { ErrorBox } from './ui';

const QUALITIES = ['ANALYTICAL', 'CALCULATED', 'IMPUTED', 'ESTIMATED'];
// One grid definition shared by the header and every row (tablet and up). On phones each row is a stacked card.
const GRID = 'md:grid-cols-[170px_110px_minmax(0,1fr)_150px_auto]';

const Label = ({ children }: { children: string }) => <span className="mb-1 block text-xs text-slate-500 md:hidden">{children}</span>;

function Row({ foodId, nutrient, existing, sources, canEdit }: {
  foodId: string; nutrient: Nutrient; existing?: FoodNutrientValue; sources: Source[]; canEdit: boolean;
}) {
  const invalidate = useInvalidate();
  const [amount, setAmount] = useState(existing ? String(Number(existing.amount)) : '');
  const [sourceId, setSourceId] = useState(existing?.source.id ?? '');
  const [quality, setQuality] = useState(existing?.quality ?? '');
  const [citation, setCitation] = useState(existing?.citation ?? '');
  const [localError, setLocalError] = useState('');

  const save = useMutation({
    mutationFn: (value: Record<string, unknown>) => api(`/admin/foods/${foodId}/nutrients`, { method: 'PUT', body: { values: [{ nutrientKey: nutrient.key, ...value }] } }),
    onSuccess: invalidate,
  });

  const submit = () => {
    setLocalError('');
    const n = Number(amount);
    if (amount.trim() === '' || Number.isNaN(n) || n < 0) return setLocalError('Enter a number of 0 or more');
    if (!sourceId) return setLocalError('Choose the source');
    if (!quality) return setLocalError('Choose the data quality');
    save.mutate({ amount: n, sourceId, quality, citation: citation.trim() || undefined });
  };

  const serverMessage = (() => {
    if (!save.error) return '';
    const i = describeError(save.error);
    return i.fields.length ? i.fields.map((f) => `${f.field}: ${f.messages.join(', ')}`).join('; ') : i.message;
  })();

  return (
    <div className={`grid gap-3 border-b border-slate-100 p-4 md:items-start ${GRID}`}>
      <div className="font-medium">{nutrient.name} <span className="text-xs font-normal text-slate-400">({nutrient.unit})</span></div>
      <label className="block">
        <Label>Amount</Label>
        <input className="input md:w-24" inputMode="decimal" value={amount} disabled={!canEdit} onChange={(e) => setAmount(e.target.value)} placeholder="—" />
      </label>
      <div className="min-w-0 space-y-1">
        <Label>Source</Label>
        <select className="input" value={sourceId} disabled={!canEdit} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select source…</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.title}{s.publicationYear ? ` (${s.publicationYear})` : ''}</option>)}
        </select>
        <input className="input" placeholder="Table / page / record ID" value={citation} disabled={!canEdit} onChange={(e) => setCitation(e.target.value)} />
      </div>
      <label className="block">
        <Label>Data quality</Label>
        <select className="input" value={quality} disabled={!canEdit} onChange={(e) => setQuality(e.target.value)}>
          <option value="">Quality…</option>{QUALITIES.map((q) => <option key={q} value={q}>{titleCase(q)}</option>)}
        </select>
      </label>
      <div>
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-primary flex-1 md:flex-none" disabled={save.isPending} onClick={submit}>Save</button>
            {existing && <button className="btn-secondary flex-1 md:flex-none" disabled={save.isPending} onClick={() => { save.mutate({ amount: null }); setAmount(''); setSourceId(''); setQuality(''); setCitation(''); }}>Remove</button>}
          </div>
        )}
        {(localError || serverMessage) && <p className="mt-1 text-xs text-red-600">{localError || serverMessage}</p>}
      </div>
    </div>
  );
}

/** One row per nutrient. A value cannot be saved without a source and a data-quality label. */
export function NutrientTable({ foodId, values, referenceForm, canEdit }: {
  foodId: string; values: FoodNutrientValue[]; referenceForm: string | null; canEdit: boolean;
}) {
  const nutrients = useQuery({ queryKey: ['nutrients'], queryFn: () => api<Nutrient[]>('/admin/nutrients') });
  const sources = useQuery({ queryKey: ['sources'], queryFn: () => api<Source[]>('/admin/sources') });
  if (nutrients.error || sources.error) return <ErrorBox error={nutrients.error ?? sources.error} />;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Nutrient values</h2>
        <p className="text-xs text-slate-500">Per 100 g of: {referenceForm ?? 'reference form not set'}. Leave blank when unavailable; never estimate without labelling it.</p>
      </div>
      <div className={`hidden bg-slate-50 px-4 py-2 md:grid md:gap-3 ${GRID}`}>
        {['Nutrient', 'Amount', 'Source', 'Quality', ''].map((h, i) => <span key={i} className="text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</span>)}
      </div>
      {(nutrients.data ?? []).map((n) => {
        const existing = values.find((v) => v.nutrientId === n.id);
        // key forces a reset of the row's inputs when the saved value changes
        return <Row key={`${n.id}-${existing?.id ?? 'none'}-${existing?.amount ?? ''}`} foodId={foodId} nutrient={n} existing={existing} sources={sources.data ?? []} canEdit={canEdit} />;
      })}
    </section>
  );
}
