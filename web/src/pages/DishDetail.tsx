import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useInvalidate } from '../lib/hooks';
import { CUISINES, DISH_CATEGORIES, fmtDate, titleCase } from '../lib/format';
import { Dish } from '../lib/types';
import { AliasEditor } from '../components/AliasEditor';
import { CommentThread } from '../components/CommentThread';
import { EditableFields, FieldDef } from '../components/EditableFields';
import { IngredientLines } from '../components/IngredientLines';
import { LivePanel } from '../components/LivePanel';
import { StatusActions } from '../components/StatusActions';
import { ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui';

const REGIONS = ['Nationwide', 'South-West', 'South-East', 'South-South', 'South-East & South-South', 'Northern Nigeria'];
const SLOTS = ['Breakfast', 'Lunch / Dinner', 'Any meal', 'Snack / Side', 'Drink', 'Sauce / Accompaniment'];
const METHODS = ['Boiled', 'Stewed / simmered', 'One-pot (simmered/steamed)', 'Stir-fried', 'Shallow-fried (pan)', 'Deep-fried', 'Steamed', 'Grilled / roasted', 'Fermented', 'Soaked / no-cook', 'Dried / cured'];

// Claim-type fields first: these are what the dietitian signs off.
const CLAIM_FIELDS: FieldDef[] = [
  { key: 'healthBenefits', label: 'Health benefits', type: 'textarea' },
  { key: 'keyNutrients', label: 'Key nutrients', type: 'textarea' },
  { key: 'cautions', label: 'Cautions / tips', type: 'textarea' },
  { key: 'frequencyGuide', label: 'Eating-frequency guide', type: 'select', options: ['REGULAR', 'MODERATE', 'OCCASIONAL', 'TREAT'], enumLabels: true },
  { key: 'allergenFlags', label: 'Allergen flags', type: 'list' },
  { key: 'containsAnimalFlesh', label: 'Animal flesh in recipe', type: 'select', options: ['YES', 'NO', 'OPTIONAL'], enumLabels: true },
  { key: 'storageGuidance', label: 'Storage guidance', type: 'textarea' },
];
const DETAIL_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: DISH_CATEGORIES },
  { key: 'cuisine', label: 'Cuisine group', type: 'select', options: CUISINES },
  { key: 'region', label: 'Region', type: 'select', options: REGIONS },
  { key: 'originNote', label: 'Origin note', type: 'text' },
  { key: 'mealSlot', label: 'Meal slot', type: 'select', options: SLOTS },
  { key: 'cookingMethod', label: 'Cooking method', type: 'select', options: METHODS },
  { key: 'spiceLevel', label: 'Spice level', type: 'select', options: ['MILD', 'MEDIUM', 'HOT'], enumLabels: true },
  { key: 'costTier', label: 'Cost tier', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH'], enumLabels: true },
  { key: 'timeText', label: 'Prep + cook time', type: 'text' },
  { key: 'totalMinutes', label: 'Total minutes', type: 'number' },
  { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['EASY', 'MEDIUM', 'HARD'], enumLabels: true },
  { key: 'servings', label: 'Servings', type: 'number' },
  { key: 'summaryIngredients', label: 'Main ingredients', type: 'textarea' },
  { key: 'servedWith', label: 'Commonly served with', type: 'text' },
  { key: 'occasion', label: 'Occasion', type: 'text' },
  { key: 'tips', label: 'Cook’s tips', type: 'textarea' },
];
const ALL_FIELDS = [...CLAIM_FIELDS, ...DETAIL_FIELDS, { key: 'ingredients', label: 'Ingredients', type: 'text' as const }, { key: 'aliases', label: 'Local names', type: 'text' as const }];

export default function DishDetail() {
  const { id = '' } = useParams();
  const { isReviewer, canEdit } = useAuth();
  const invalidate = useInvalidate();
  const [focusField, setFocusField] = useState<string | null>(null);
  const { data: d, error, isLoading } = useQuery({ queryKey: ['dish', id], queryFn: () => api<Dish>(`/admin/dishes/${id}`) });

  const flags = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api(`/admin/dishes/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: invalidate,
  });

  if (isLoading) return <Spinner />;
  if (error || !d) return <ErrorBox error={error} />;
  const openComments = d.comments.filter((c) => !c.resolved && c.field !== 'status').length;
  const row = d as unknown as Record<string, unknown>;
  const editable = canEdit && d.status !== 'ARCHIVED';

  return (
    <>
      <p className="mb-2 text-sm"><Link className="text-brand-600 hover:underline" to="/dishes">← Dishes</Link></p>
      <PageHeader
        title={d.name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={d.status} /><span>#{d.legacyNo} · {d.slug}</span><span>Updated {fmtDate(d.updatedAt)}</span></span>}
      />
      {/* Phones: status actions first, then the content, then comments. From xl up: content left, sticky side column right. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 min-w-0 space-y-5 xl:order-none">
          <EditableFields title="Claims for review" kind="dish" id={d.id} status={d.status} data={row} fields={CLAIM_FIELDS} canEdit={editable} comments={d.comments} onComment={setFocusField} />
          <IngredientLines dishId={d.id} lines={d.lines} canEdit={editable} />
          <section className="card">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Preparation steps</h2>
            <ol className="space-y-2 px-4 py-3 text-sm">
              {d.steps.map((s) => <li key={s.id} className="flex gap-3"><span className="w-5 shrink-0 text-right text-slate-400">{s.stepNumber}.</span><span>{s.instruction}</span></li>)}
            </ol>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Steps are read-only here for now.</p>
          </section>
          <AliasEditor kind="dish" id={d.id} aliases={d.aliases} canEdit={editable} isReviewer={isReviewer} />
          <EditableFields title="Dish details" kind="dish" id={d.id} status={d.status} data={row} fields={DETAIL_FIELDS} canEdit={editable} comments={d.comments} onComment={setFocusField} />
        </div>
        <div className="contents xl:block xl:space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="order-1 space-y-5 xl:order-none">
            <StatusActions kind="dish" id={d.id} status={d.status} allowed={d.allowedTransitions} openComments={openComments} />
            <LivePanel dish={d} canEdit={editable} />
          </div>
          <div id="comments" className="order-3 scroll-mt-20 xl:order-none">
            <CommentThread kind="dish" id={d.id} comments={d.comments} fields={ALL_FIELDS} focusField={focusField} canComment={canEdit} />
          </div>
          <div className="order-4 xl:order-none">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Reviewer flags</h2>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.namesVerified} disabled={!isReviewer || flags.isPending} onChange={(e) => flags.mutate({ namesVerified: e.target.checked })} />
              Local names verified
            </label>
            <label className="mb-1 block text-xs font-medium text-slate-500">Evidence level</label>
            <select className="input" value={d.evidenceLevel} disabled={!isReviewer || flags.isPending} onChange={(e) => flags.mutate({ evidenceLevel: e.target.value })}>
              {['A_SCIENTIFIC', 'B_RESEARCH', 'C_COMMUNITY', 'D_PROFESSIONAL_REVIEW'].map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
            </select>
            {!isReviewer && <p className="mt-2 text-xs text-slate-500">Only reviewers can change these.</p>}
            {flags.error && <div className="mt-2"><ErrorBox error={flags.error} /></div>}
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
