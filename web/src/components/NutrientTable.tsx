import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useInvalidate } from '../lib/hooks';
import { FoodNutrientValue, Nutrient, Source } from '../lib/types';
import { titleCase } from '../lib/format';
import { describeError } from '../lib/errors';
import { ErrorBox } from './ui';

const QUALITIES = ['ANALYTICAL', 'CALCULATED', 'IMPUTED', 'ESTIMATED'];

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

  return (
    <tr className="align-top">
      <td className="td font-medium">{nutrient.name} <span className="text-xs font-normal text-slate-400">({nutrient.unit})</span></td>
      <td className="td"><input className="input w-24" inputMode="decimal" value={amount} disabled={!canEdit} onChange={(e) => setAmount(e.target.value)} placeholder="—" /></td>
      <td className="td">
        <select className="input" value={sourceId} disabled={!canEdit} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select source…</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.title}{s.publicationYear ? ` (${s.publicationYear})` : ''}</option>)}
        </select>
        <input className="input mt-1" placeholder="Table / page / record ID" value={citation} disabled={!canEdit} onChange={(e) => setCitation(e.target.value)} />
      </td>
      <td className="td">
        <select className="input" value={quality} disabled={!canEdit} onChange={(e) => setQuality(e.target.value)}>
          <option value="">Quality…</option>{QUALITIES.map((q) => <option key={q} value={q}>{titleCase(q)}</option>)}
        </select>
      </td>
      <td className="td whitespace-nowrap">
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-primary" disabled={save.isPending} onClick={submit}>Save</button>
            {existing && <button className="btn-secondary" disabled={save.isPending} onClick={() => { save.mutate({ amount: null }); setAmount(''); setSourceId(''); setQuality(''); setCitation(''); }}>Remove</button>}
          </div>
        )}
        {(localError || save.error) && <p className="mt-1 text-xs text-red-600">{localError || (() => { const i = describeError(save.error); return i.fields.length ? i.fields.map((f) => `${f.field}: ${f.messages.join(', ')}`).join('; ') : i.message; })()}</p>}
      </td>
    </tr>
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
      <table className="w-full">
        <thead className="bg-slate-50"><tr><th className="th">Nutrient</th><th className="th">Amount</th><th className="th">Source</th><th className="th">Quality</th><th className="th" /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {(nutrients.data ?? []).map((n) => {
            const existing = values.find((v) => v.nutrientId === n.id);
            // key forces a reset of the row's inputs when the saved value changes
            return <Row key={`${n.id}-${existing?.id ?? 'none'}-${existing?.amount ?? ''}`} foodId={foodId} nutrient={n} existing={existing} sources={sources.data ?? []} canEdit={canEdit} />;
          })}
        </tbody>
      </table>
    </section>
  );
}
