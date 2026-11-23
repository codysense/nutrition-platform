import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate } from '../lib/format';
import { Queue } from '../lib/types';
import { Column, DataTable } from '../components/DataTable';
import { ErrorBox, PageHeader, Spinner } from '../components/ui';

type Row = { id: string; title: string; sub: string; category: string; updatedAt: string; lastEditedById: string | null; open: number; to: string };

function Table({ title, rows, myId }: { title: string; rows: Row[]; myId?: string }) {
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Name', title: true, cell: (r) => <><Link className="font-medium text-brand-700 hover:underline" to={r.to}>{r.title}</Link> <span className="text-xs font-normal text-slate-400">{r.sub}</span></> },
    { key: 'category', header: 'Category', cell: (r) => <span className="text-slate-600">{r.category}</span> },
    { key: 'since', header: 'Waiting since', cell: (r) => <span className="text-slate-600">{fmtDate(r.updatedAt)}</span> },
    { key: 'open', header: 'Open comments', cell: (r) => (r.open > 0 ? <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{r.open}</span> : '—') },
    { key: 'note', header: '', align: 'right', cell: (r) => (r.lastEditedById === myId ? <span className="text-xs">You edited this last, so someone else must approve it</span> : null) },
  ];
  return (
    <section className="card mb-5 overflow-hidden">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{title} ({rows.length})</h2>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} empty="Nothing waiting." />
    </section>
  );
}

export default function ReviewQueue() {
  const { user } = useAuth();
  const { data, error, isLoading } = useQuery({ queryKey: ['queue'], queryFn: () => api<Queue>('/admin/review/queue') });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  const dishes: Row[] = data.recipes.map((r) => ({ id: r.id, title: r.name, sub: r.legacyNo ? `#${r.legacyNo}` : '', category: r.category, updatedAt: r.updatedAt, lastEditedById: r.lastEditedById, open: r._count.comments, to: `/dishes/${r.id}` }));
  const foods: Row[] = data.foods.map((f) => ({ id: f.id, title: f.name, sub: f.code, category: f.category, updatedAt: f.updatedAt, lastEditedById: f.lastEditedById, open: f._count.comments, to: `/foods/${f.id}` }));
  return (
    <>
      <PageHeader title="Review queue" subtitle="Content submitted for professional review, oldest first." />
      <Table title="Dishes" rows={dishes} myId={user?.id} />
      <Table title="Foodstuffs" rows={foods} myId={user?.id} />
    </>
  );
}
