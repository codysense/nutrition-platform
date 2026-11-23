import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { basePath, useInvalidate } from '../lib/hooks';
import { AllowedTransition, Kind, ReviewStatus } from '../lib/types';
import { ErrorBox, StatusBadge } from './ui';

const LABEL: Record<ReviewStatus, string> = {
  APPROVED: 'Approve', REJECTED: 'Reject', REQUIRES_UPDATE: 'Request changes', PENDING_REVIEW: 'Submit for review',
  PUBLISHED: 'Publish', DRAFT: 'Return to draft', ARCHIVED: 'Archive',
};
const STYLE: Partial<Record<ReviewStatus, string>> = {
  APPROVED: 'btn-primary', PUBLISHED: 'btn-primary', PENDING_REVIEW: 'btn-primary', REJECTED: 'btn-danger', ARCHIVED: 'btn-secondary',
};
const NOTE_HINT: Partial<Record<ReviewStatus, string>> = {
  REJECTED: 'Why is this being rejected?', REQUIRES_UPDATE: 'What needs to change?',
};

export function StatusActions({ kind, id, status, allowed, openComments }: {
  kind: Kind; id: string; status: ReviewStatus; allowed: AllowedTransition[]; openComments: number;
}) {
  const invalidate = useInvalidate();
  const [pending, setPending] = useState<AllowedTransition | null>(null);
  const [note, setNote] = useState('');

  const m = useMutation({
    mutationFn: (v: { to: ReviewStatus; note?: string }) => api(`${basePath(kind)}/${id}/status`, { method: 'POST', body: v }),
    onSuccess: async () => {
      setPending(null);
      setNote('');
      await invalidate();
    },
  });

  const go = (t: AllowedTransition) => {
    if (t.noteRequired) setPending(t);
    else m.mutate({ to: t.to });
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Review status</h2>
        <StatusBadge status={status} />
      </div>

      {allowed.length === 0 ? (
        <p className="text-sm text-slate-500">No actions available for your role at this stage.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowed.map((t) => (
            <button
              key={t.to}
              className={STYLE[t.to] ?? 'btn-secondary'}
              disabled={m.isPending || !!t.blockedReason || (t.to === 'APPROVED' && openComments > 0)}
              title={t.blockedReason ?? (t.to === 'APPROVED' && openComments > 0 ? 'Resolve open comments first' : undefined)}
              onClick={() => go(t)}
            >
              {LABEL[t.to]}
            </button>
          ))}
        </div>
      )}

      {openComments > 0 && (
        <a href="#comments" className="mt-3 block text-sm font-medium text-brand-700 hover:underline xl:hidden">
          Jump to {openComments} open comment{openComments === 1 ? '' : 's'} ↓
        </a>
      )}
      {allowed.some((t) => t.blockedReason) && (
        <p className="mt-2 text-xs text-amber-700">{allowed.find((t) => t.blockedReason)!.blockedReason}.</p>
      )}
      {allowed.some((t) => t.to === 'APPROVED') && openComments > 0 && (
        <p className="mt-2 text-xs text-amber-700">{openComments} open comment{openComments === 1 ? '' : 's'} must be resolved before approval.</p>
      )}

      {pending && (
        <div className="mt-3 space-y-2 rounded-md bg-slate-50 p-3">
          <label className="block text-sm font-medium text-slate-700">{NOTE_HINT[pending.to] ?? 'Add a note'} (required)</label>
          <textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button className={STYLE[pending.to] ?? 'btn-secondary'} disabled={!note.trim() || m.isPending} onClick={() => m.mutate({ to: pending.to, note })}>
              Confirm: {LABEL[pending.to]}
            </button>
            <button className="btn-secondary" onClick={() => { setPending(null); setNote(''); }}>Cancel</button>
          </div>
        </div>
      )}
      {m.error && <div className="mt-3"><ErrorBox error={m.error} /></div>}
    </div>
  );
}
