import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate } from '../lib/format';
import { Queue } from '../lib/types';
import { ErrorBox, PageHeader, Spinner } from '../components/ui';

type Row = { id: string; title: string; sub: string; category: string; updatedAt: string; lastEditedById: string | null; open: number; to: string };

function Table({ title, rows, myId }: { title: string; rows: Row[]; myId?: string }) {
  return (
    <section className="card mb-5 overflow-hidden">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{title} ({rows.length})</h2>
      {rows.length === 0 ? <p className="p-4 text-sm text-slate-500">Nothing waiting.</p> : (
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">Name</th><th className="th">Category</th><th className="th">Waiting since</th><th className="th">Open comments</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={r.to}>{r.title}</Link> <span className="text-xs text-slate-400">{r.sub}</span></td>
                <td className="td text-slate-600">{r.category}</td>
                <td className="td text-slate-600">{fmtDate(r.updatedAt)}</td>
                <td className="td">{r.open > 0 ? <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{r.open}</span> : '—'}</td>
                <td className="td text-right text-xs text-slate-500">{r.lastEditedById === myId ? 'You edited this last' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
