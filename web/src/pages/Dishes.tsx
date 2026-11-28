import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { CUISINES, DISH_CATEGORIES, STATUSES, STATUS_LABEL } from '../lib/format';
import { DishListItem, Paged } from '../lib/types';
import { useSelection } from '../lib/useSelection';
import { BulkBar } from '../components/BulkBar';
import { Column, DataTable } from '../components/DataTable';
import { ErrorBox, PageHeader, Pager, StatusBadge } from '../components/ui';

export default function Dishes() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [live, setLive] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, error, isFetching } = useQuery({
    queryKey: ['dishes', q, status, category, cuisine, live, page],
    queryFn: () => api<Paged<DishListItem>>('/admin/dishes' + qs({ q, status, category, cuisine, live, page, pageSize })),
    placeholderData: keepPreviousData,
  });
  const sel = useSelection(data?.items.map((d) => d.id) ?? []);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); sel.setAllMatching(false); };

  const columns: Column<DishListItem>[] = [
    { key: 'no', header: '#', cell: (d) => <span className="text-slate-400">{d.legacyNo}</span>, hideOnMobile: true },
    { key: 'name', header: 'Dish', title: true, cell: (d) => <Link className="font-medium text-brand-700 hover:underline" to={`/dishes/${d.id}`}>{d.name}</Link> },
    { key: 'category', header: 'Category', cell: (d) => <span className="text-slate-600">{d.category}</span> },
    { key: 'cuisine', header: 'Cuisine', cell: (d) => <span className="text-slate-600">{d.cuisine ?? '—'}</span> },
    { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
    { key: 'live', header: 'Public', cell: (d) => (d.liveSnapshot ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Live v{d.liveSnapshot.version}</span> : <span className="text-slate-400">—</span>) },
    { key: 'comments', header: 'Open comments', cell: (d) => d._count.comments || '—' },
    { key: 'lines', header: 'Lines to confirm', cell: (d) => d._count.lines || '—' },
  ];

  return (
    <>
      <PageHeader title="Dishes" subtitle="All dishes in the dataset with their review state." />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <select className="input" value={live} onChange={(e) => reset(setLive)(e.target.value)}>
          <option value="">Live and not live</option><option value="true">Live only</option><option value="false">Not live</option>
        </select>
      </div>
      {error && <ErrorBox error={error} />}
      <BulkBar
        kind="dish" selectedIds={[...sel.selected]} allMatching={sel.allMatching} filter={{ q, status, category, cuisine, live }}
        total={data?.total ?? 0} pageCount={data?.items.length ?? 0} pageAllSelected={sel.allOnPage}
        onSelectAllMatching={() => sel.setAllMatching(true)} onClear={sel.clear}
      />
      <div className={`card overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
        <DataTable
          rows={data?.items ?? []} columns={columns} rowKey={(d) => d.id} empty="No dishes match."
          selection={{ isSelected: (d) => sel.allMatching || sel.selected.has(d.id), toggle: (d) => sel.toggle(d.id), allOnPage: sel.allOnPage, togglePage: sel.togglePage, label: (d) => d.name }}
        />
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
