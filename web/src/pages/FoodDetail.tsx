import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useInvalidate } from '../lib/hooks';
import { FOOD_CATEGORIES, fmtDate } from '../lib/format';
import { Food } from '../lib/types';
import { AliasEditor } from '../components/AliasEditor';
import { CommentThread } from '../components/CommentThread';
import { EditableFields, FieldDef } from '../components/EditableFields';
import { NutrientTable } from '../components/NutrientTable';
import { StatusActions } from '../components/StatusActions';
import { ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui';

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: FOOD_CATEGORIES },
  { key: 'botanicalName', label: 'Botanical name', type: 'text' },
  { key: 'forms', label: 'Common forms', type: 'text' },
  { key: 'allergenNote', label: 'Allergen note', type: 'text' },
  { key: 'referenceForm', label: 'Nutrient reference form', type: 'text' },
];
const COMMENT_FIELDS = [...FIELDS.map((f) => ({ key: f.key, label: f.label })), { key: 'nutrients', label: 'Nutrient values' }, { key: 'aliases', label: 'Local names' }];

export default function FoodDetail() {
  const { id = '' } = useParams();
  const { isReviewer, canEdit } = useAuth();
  const invalidate = useInvalidate();
  const [focusField, setFocusField] = useState<string | null>(null);
  const { data: f, error, isLoading } = useQuery({ queryKey: ['food', id], queryFn: () => api<Food>(`/admin/foods/${id}`) });
  const flags = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api(`/admin/foods/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: invalidate,
  });

  if (isLoading) return <Spinner />;
  if (error || !f) return <ErrorBox error={error} />;
  const openComments = f.comments.filter((c) => !c.resolved && c.field !== 'status').length;
  const editable = canEdit && f.status !== 'ARCHIVED';

  return (
    <>
      <p className="mb-2 text-sm"><Link className="text-brand-600 hover:underline" to="/foods">← Foodstuffs</Link></p>
      <PageHeader title={f.name} subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={f.status} /><span>{f.code}</span><span>Updated {fmtDate(f.updatedAt)}</span></span>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 min-w-0 space-y-5 xl:order-none">
          <EditableFields title="Foodstuff details" kind="food" id={f.id} status={f.status} data={f as unknown as Record<string, unknown>} fields={FIELDS} canEdit={editable} comments={f.comments} onComment={setFocusField} />
          <NutrientTable foodId={f.id} values={f.nutrients} referenceForm={f.referenceForm} canEdit={editable} />
          <AliasEditor kind="food" id={f.id} aliases={f.aliases} canEdit={editable} isReviewer={isReviewer} />
          <section className="card">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Used in dishes ({f.usedIn.length})</h2>
            <ul className="flex flex-wrap gap-2 p-4 text-sm">
              {f.usedIn.length === 0 && <li className="text-slate-400">Not linked to any dish yet.</li>}
              {f.usedIn.map((r) => <li key={r.id}><Link className="rounded bg-slate-100 px-2 py-1 text-brand-700 hover:underline" to={`/dishes/${r.id}`}>{r.name}</Link></li>)}
            </ul>
          </section>
        </div>
        <div className="contents xl:block xl:space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="order-1 xl:order-none">
            <StatusActions kind="food" id={f.id} status={f.status} allowed={f.allowedTransitions} openComments={openComments} />
          </div>
          <div id="comments" className="order-3 scroll-mt-20 xl:order-none">
            <CommentThread kind="food" id={f.id} comments={f.comments} fields={COMMENT_FIELDS} focusField={focusField} canComment={canEdit} />
          </div>
          <div className="order-4 xl:order-none">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Reviewer flags</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.namesVerified} disabled={!isReviewer || flags.isPending} onChange={(e) => flags.mutate({ namesVerified: e.target.checked })} />
              Local names verified
            </label>
            {!isReviewer && <p className="mt-2 text-xs text-slate-500">Only reviewers can change this.</p>}
            {flags.error && <div className="mt-2"><ErrorBox error={flags.error} /></div>}
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
