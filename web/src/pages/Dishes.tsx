import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { CUISINES, DISH_CATEGORIES, STATUSES, STATUS_LABEL } from '../lib/format';
import { DishListItem, Paged } from '../lib/types';
import { useSelection } from '../lib/useSelection';
import { BulkBar } from '../components/BulkBar';
import { ErrorBox, PageHeader, Pager, StatusBadge } from '../components/ui';

export default function Dishes() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, error, isFetching } = useQuery({
    queryKey: ['dishes', q, status, category, cuisine, page],
    queryFn: () => api<Paged<DishListItem>>('/admin/dishes' + qs({ q, status, category, cuisine, page, pageSize })),
    placeholderData: keepPreviousData,
  });
  const sel = useSelection(data?.items.map((d) => d.id) ?? []);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); sel.setAllMatching(false); };

  return (
    <>
      <PageHeader title="Dishes" subtitle="All dishes in the dataset with their review state." />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" placeholder="Search name or local name…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <select className="input" value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="input" value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
          <option value="">All categories</option>{DISH_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input" value={cuisine} onChange={(e) => reset(setCuisine)(e.target.value)}>
          <option value="">All cuisines</option>{CUISINES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {error && <ErrorBox error={error} />}
      <BulkBar
        kind="dish" selectedIds={[...sel.selected]} allMatching={sel.allMatching} filter={{ q, status, category, cuisine }}
        total={data?.total ?? 0} pageCount={data?.items.length ?? 0} pageAllSelected={sel.allOnPage}
        onSelectAllMatching={() => sel.setAllMatching(true)} onClear={sel.clear}
      />
      <div className={`card overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th w-8"><input type="checkbox" aria-label="Select all on this page" checked={sel.allOnPage} onChange={sel.togglePage} /></th><th className="th">#</th><th className="th">Dish</th><th className="th">Category</th><th className="th">Cuisine</th><th className="th">Status</th><th className="th">Open comments</th><th className="th">Unmapped lines</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="td"><input type="checkbox" aria-label={`Select ${d.name}`} checked={sel.allMatching || sel.selected.has(d.id)} onChange={() => sel.toggle(d.id)} /></td>
                <td className="td text-slate-400">{d.legacyNo}</td>
                <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/dishes/${d.id}`}>{d.name}</Link></td>
                <td className="td text-slate-600">{d.category}</td>
                <td className="td text-slate-600">{d.cuisine ?? '—'}</td>
                <td className="td"><StatusBadge status={d.status} /></td>
                <td className="td">{d._count.comments || '—'}</td>
                <td className="td">{d._count.lines || '—'}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td className="td text-slate-500" colSpan={8}>No dishes match.</td></tr>}
          </tbody>
        </table>
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
