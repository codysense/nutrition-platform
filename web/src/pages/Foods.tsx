import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { FOOD_CATEGORIES, STATUSES, STATUS_LABEL } from '../lib/format';
import { FoodListItem, Paged } from '../lib/types';
import { useSelection } from '../lib/useSelection';
import { BulkBar } from '../components/BulkBar';
import { ErrorBox, PageHeader, Pager, StatusBadge } from '../components/ui';

export default function Foods() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, isFetching } = useQuery({
    queryKey: ['foods', q, status, category, missing, page],
    queryFn: () => api<Paged<FoodListItem>>('/admin/foods' + qs({ q, status, category, missingNutrients: missing ? 'true' : undefined, page, pageSize: 50 })),
    placeholderData: keepPreviousData,
  });
  const sel = useSelection(data?.items.map((f) => f.id) ?? []);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); sel.setAllMatching(false); };

  return (
    <>
      <PageHeader title="Foodstuffs" subtitle="Ingredient master list. “Used in” shows how many ingredient lines reference each item, which helps decide what nutrient data to source first." />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" placeholder="Search name or local name…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <select className="input" value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="input" value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
          <option value="">All categories</option>{FOOD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={missing} onChange={(e) => reset(setMissing)(e.target.checked)} /> Only without nutrient values</label>
      </div>
      {error && <ErrorBox error={error} />}
      <BulkBar
        kind="food" selectedIds={[...sel.selected]} allMatching={sel.allMatching}
        filter={{ q, status, category, missingNutrients: missing ? 'true' : undefined }}
        total={data?.total ?? 0} pageCount={data?.items.length ?? 0} pageAllSelected={sel.allOnPage}
        onSelectAllMatching={() => sel.setAllMatching(true)} onClear={sel.clear}
      />
      <div className={`card overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th w-8"><input type="checkbox" aria-label="Select all on this page" checked={sel.allOnPage} onChange={sel.togglePage} /></th><th className="th">Code</th><th className="th">Foodstuff</th><th className="th">Category</th><th className="th">Local names</th><th className="th">Status</th><th className="th">Used in</th><th className="th">Nutrients</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="td"><input type="checkbox" aria-label={`Select ${f.name}`} checked={sel.allMatching || sel.selected.has(f.id)} onChange={() => sel.toggle(f.id)} /></td>
                <td className="td text-slate-400">{f.code}</td>
                <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/foods/${f.id}`}>{f.name}</Link></td>
                <td className="td text-slate-600">{f.category}</td>
                <td className="td text-xs text-slate-600">{f.aliases.map((a) => a.name).join(', ') || '—'}</td>
                <td className="td"><StatusBadge status={f.status} /></td>
                <td className="td">{f._count.lines} lines</td>
                <td className="td">{f._count.nutrients}/11</td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={8}>No foodstuffs match.</td></tr>}
          </tbody>
        </table>
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
