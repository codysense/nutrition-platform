import { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { fmtDate, STATUS_LABEL, titleCase } from '../lib/format';
import { ExportDish, ReviewStatus } from '../lib/types';
import { ErrorBox, Spinner } from '../components/ui';

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <tr className="align-top">
    <th className="w-40 border border-slate-300 bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold">{label}</th>
    <td className="border border-slate-300 px-2 py-1.5 text-sm">{children || <span className="text-slate-400">—</span>}</td>
  </tr>
);

/** Print-friendly sheet: one dish per page with space for the reviewer's decision and notes. */
export default function ReviewSheet() {
  const [params] = useSearchParams();
  const status = params.get('status') ?? '';
  const { data, error, isLoading } = useQuery({
    queryKey: ['sheet', status],
    queryFn: () => api<{ generatedAt: string; items: ExportDish[] }>('/admin/export/dishes.json' + qs({ status })),
  });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold">Review sheet</h1>
          <p className="text-sm text-slate-500">{data.items.length} dish{data.items.length === 1 ? '' : 'es'} · {status ? STATUS_LABEL[status as ReviewStatus] : 'All statuses'}</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      {data.items.length === 0 && <p className="text-sm text-slate-500">No dishes with this status.</p>}
      {data.items.map((d) => (
        <article key={d.id} className="mb-10 break-after-page print:mb-0">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Draft for professional review · not for publication · generated {fmtDate(data.generatedAt)}</p>
          <h2 className="text-lg font-semibold">#{d.legacyNo} {d.name}</h2>
          <p className="mb-3 text-sm text-slate-600">{[d.category, d.cuisine, d.region].filter(Boolean).join(' · ')} · Status: {STATUS_LABEL[d.status]}</p>
          <table className="mb-3 w-full border-collapse"><tbody>
            <Row label="Health benefits">{d.healthBenefits}</Row>
            <Row label="Key nutrients">{d.keyNutrients}</Row>
            <Row label="Cautions / tips">{d.cautions}</Row>
            <Row label="Eating-frequency guide">{titleCase(d.frequencyGuide)}</Row>
            <Row label="Allergen flags">{d.allergenFlags.join('; ')}</Row>
            <Row label="Animal flesh in recipe">{titleCase(d.containsAnimalFlesh)}</Row>
            <Row label="Storage guidance">{d.storageGuidance}</Row>
            <Row label="Local names">{d.aliases.map((a) => `${titleCase(a.language)}: ${a.name}${a.verified ? ' (verified)' : ''}`).join('; ')}</Row>
          </tbody></table>
          <p className="mb-1 text-xs font-semibold">Ingredients</p>
          <ul className="mb-3 list-disc pl-5 text-sm">{d.ingredients.map((i) => <li key={i}>{i}</li>)}</ul>
          {d.openComments.length > 0 && (
            <div className="mb-3 text-sm">
              <p className="mb-1 text-xs font-semibold">Open comments</p>
              <ul className="list-disc pl-5">{d.openComments.map((c, i) => <li key={i}>[{c.field ?? 'general'}] {c.author}: {c.body}</li>)}</ul>
            </div>
          )}
          <div className="rounded border border-slate-300 p-3 text-sm">
            <p className="font-semibold">Reviewer decision</p>
            <p className="my-2">☐ Approve &nbsp;&nbsp; ☐ Approve after the changes below &nbsp;&nbsp; ☐ Reject</p>
            <p className="mb-1 text-xs text-slate-500">Notes (please name the field each note refers to)</p>
            <div className="h-24 border-t border-dashed border-slate-300" />
          </div>
        </article>
      ))}
    </div>
  );
}
