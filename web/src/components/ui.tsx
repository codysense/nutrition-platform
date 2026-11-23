import { ReactNode } from 'react';
import { ReviewStatus } from '../lib/types';
import { STATUS_LABEL, STATUS_STYLE } from '../lib/format';
import { describeError } from '../lib/errors';

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <p className="p-6 text-sm text-slate-500">{label}</p>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const info = describeError(error);
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p className="font-medium">{info.title}</p>
      {info.message && <p>{info.message}</p>}
      {info.fields.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {info.fields.map((f) => <li key={f.field}><span className="font-medium">{f.field}:</span> {f.messages.join(', ')}</li>)}
        </ul>
      )}
      {info.hints.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-red-700">{info.hints.map((h) => <li key={h}>{h}</li>)}</ul>
      )}
      {info.technical.length > 0 && (
        <details className="mt-2 text-xs text-red-700">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <ul className="mt-1 break-all font-mono">{info.technical.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}

export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col items-center gap-2 border-t border-slate-200 px-3 py-3 text-sm text-slate-600 sm:flex-row sm:justify-between sm:py-2">
      <span>{total} result{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-3 sm:gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
