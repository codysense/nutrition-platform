import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { FOOD_CATEGORIES, STATUSES, STATUS_LABEL } from '../lib/format';
import { FoodListItem, Paged } from '../lib/types';
import { useSelection } from '../lib/useSelection';
import { BulkBar } from '../components/BulkBar';
import { Column, DataTable } from '../components/DataTable';
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

  const columns: Column<FoodListItem>[] = [
    { key: 'code', header: 'Code', cell: (f) => <span className="text-slate-400">{f.code}</span>, hideOnMobile: true },
    { key: 'name', header: 'Foodstuff', title: true, cell: (f) => <Link className="font-medium text-brand-700 hover:underline" to={`/foods/${f.id}`}>{f.name}</Link> },
    { key: 'category', header: 'Category', cell: (f) => <span className="text-slate-600">{f.category}</span> },
    { key: 'names', header: 'Local names', cell: (f) => <span className="text-xs text-slate-600">{f.aliases.map((a) => a.name).join(', ') || '—'}</span> },
    { key: 'status', header: 'Status', cell: (f) => <StatusBadge status={f.status} /> },
    { key: 'used', header: 'Used in', cell: (f) => `${f._count.lines} lines` },
    { key: 'nutrients', header: 'Nutrients', cell: (f) => `${f._count.nutrients}/11` },
  ];

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
        <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={missing} onChange={(e) => reset(setMissing)(e.target.checked)} /> Only without nutrient values</label>
      </div>
      {error && <ErrorBox error={error} />}
      <BulkBar
        kind="food" selectedIds={[...sel.selected]} allMatching={sel.allMatching}
        filter={{ q, status, category, missingNutrients: missing ? 'true' : undefined }}
        total={data?.total ?? 0} pageCount={data?.items.length ?? 0} pageAllSelected={sel.allOnPage}
        onSelectAllMatching={() => sel.setAllMatching(true)} onClear={sel.clear}
      />
      <div className={`card overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
        <DataTable
          rows={data?.items ?? []} columns={columns} rowKey={(f) => f.id} empty="No foodstuffs match."
          selection={{ isSelected: (f) => sel.allMatching || sel.selected.has(f.id), toggle: (f) => sel.toggle(f.id), allOnPage: sel.allOnPage, togglePage: sel.togglePage, label: (f) => f.name }}
        />
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
