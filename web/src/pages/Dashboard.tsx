import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { STATUSES, STATUS_LABEL, STATUS_STYLE } from '../lib/format';
import { Stats } from '../lib/types';
import { ErrorBox, PageHeader, Spinner } from '../components/ui';

function StatusBars({ title, counts }: { title: string; counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <ul className="space-y-2">
        {STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className="w-28 text-slate-600">{STATUS_LABEL[s]}</span>
            <div className="h-2 flex-1 rounded bg-slate-100"><div className={`h-2 rounded ${STATUS_STYLE[s].split(' ')[0]}`} style={{ width: `${((counts[s] ?? 0) / total) * 100}%` }} /></div>
            <span className="w-8 text-right tabular-nums">{counts[s] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tile({ label, value, to, tone = 'text-slate-900' }: { label: string; value: number | string; to?: string; tone?: string }) {
  const body = (
    <div className="card p-4 transition hover:shadow">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { data, error, isLoading } = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/admin/stats') });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  const pending = (data.recipesByStatus.PENDING_REVIEW ?? 0) + (data.foodsByStatus.PENDING_REVIEW ?? 0);
  return (
    <>
      <PageHeader title="Overview" subtitle="Where the dataset stands in review and how complete the nutrient data is." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Waiting for review" value={pending} to="/review" tone={pending ? 'text-amber-700' : undefined} />
        <Tile label="Open comments" value={data.openComments} />
        <Tile label="Unmapped ingredient lines" value={data.unmappedIngredientLines} to="/dishes" />
        <Tile label="Dishes with unverified names" value={data.recipesWithUnverifiedNames} />
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <StatusBars title="Dishes by status" counts={data.recipesByStatus} />
        <StatusBars title="Foodstuffs by status" counts={data.foodsByStatus} />
      </div>
      <div className="card p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Nutrient data coverage</h2>
        <p className="mb-3 text-xs text-slate-500">{data.foods.withNutrientValues} of {data.foods.total} foodstuffs have at least one sourced value. Blank means unavailable, never estimated.</p>
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {data.nutrientCoverage.map((n) => (
            <li key={n.key} className="flex items-center gap-3 text-sm">
              <span className="w-32 text-slate-600">{n.name}</span>
              <div className="h-2 flex-1 rounded bg-slate-100"><div className="h-2 rounded bg-brand-500" style={{ width: `${n.totalFoods ? (n.foodsWithValue / n.totalFoods) * 100 : 0}%` }} /></div>
              <span className="w-14 text-right tabular-nums">{n.foodsWithValue}/{n.totalFoods}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
