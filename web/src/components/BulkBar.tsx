import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { basePath, useInvalidate } from '../lib/hooks';
import { BulkResult, Kind, ReviewStatus, Role } from '../lib/types';
import { ErrorBox } from './ui';

interface Option { to: ReviewStatus; label: string; roles: Role[]; noteRequired?: boolean }

// Mirrors who may do what, for display only: the server re-checks every item and reports the ones it skipped.
// Approval is deliberately absent: it must be done one item at a time.
const OPTIONS: Option[] = [
  { to: 'PENDING_REVIEW', label: 'Submit for review', roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { to: 'DRAFT', label: 'Return to draft', roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { to: 'PUBLISHED', label: 'Publish (approved items only)', roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { to: 'REQUIRES_UPDATE', label: 'Request changes', roles: ['SUPER_ADMIN', 'NUTRITION_REVIEWER'], noteRequired: true },
  { to: 'REJECTED', label: 'Reject', roles: ['SUPER_ADMIN', 'NUTRITION_REVIEWER'], noteRequired: true },
  { to: 'ARCHIVED', label: 'Archive', roles: ['SUPER_ADMIN'] },
];

export function BulkBar({ kind, selectedIds, allMatching, filter, total, pageCount, pageAllSelected, onSelectAllMatching, onClear }: {
  kind: Kind; selectedIds: string[]; allMatching: boolean; filter: Record<string, string | undefined>;
  total: number; pageCount: number; pageAllSelected: boolean; onSelectAllMatching: () => void; onClear: () => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const options = OPTIONS.filter((o) => user && o.roles.includes(user.role));
  const [to, setTo] = useState<ReviewStatus | ''>('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const count = allMatching ? total : selectedIds.length;
  const chosen = options.find((o) => o.to === to);

  const run = useMutation({
    mutationFn: () => {
      const cleanFilter = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      return api<BulkResult>(`${basePath(kind)}/bulk-status`, {
        method: 'POST',
        body: { ...(allMatching ? { filter: cleanFilter } : { ids: selectedIds }), to, note: note.trim() || undefined },
      });
    },
    onSuccess: async (r) => {
      setResult(r);
      setConfirming(false);
      setNote('');
      onClear();
      await invalidate();
    },
  });

  const reasons = result ? Object.entries(result.skipped.reduce<Record<string, string[]>>((acc, s) => ((acc[s.reason] ??= []).push(s.name), acc), {})) : [];

  return (
    <>
      {result && (
        <div className="card mb-4 border-l-4 border-l-brand-500 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">Moved {result.moved} of {result.total}{result.skipped.length > 0 && `, skipped ${result.skipped.length}`}.</p>
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setResult(null)}>Dismiss</button>
          </div>
          {reasons.map(([reason, names]) => (
            <p key={reason} className="mt-2 text-slate-600">
              <span className="font-medium">{reason}:</span> {names.slice(0, 6).join(', ')}{names.length > 6 && ` and ${names.length - 6} more`}
            </p>
          ))}
        </div>
      )}

      {count > 0 && (
        <div className="card mb-4 border-brand-500 bg-brand-50 p-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{count} selected{allMatching && ' (all matching the current filters)'}</span>
            {pageAllSelected && !allMatching && total > pageCount && (
              <button className="text-brand-700 hover:underline" onClick={onSelectAllMatching}>Select all {total} matching</button>
            )}
            <button className="text-slate-500 hover:underline" onClick={onClear}>Clear</button>
            <span className="mx-1 text-slate-300">|</span>
            <select className="input w-auto" value={to} onChange={(e) => { setTo(e.target.value as ReviewStatus | ''); setConfirming(false); }}>
              <option value="">Move to…</option>
              {options.map((o) => <option key={o.to} value={o.to}>{o.label}</option>)}
            </select>
            {chosen && !confirming && (
              <button className="btn-primary" disabled={chosen.noteRequired && !note.trim()} onClick={() => setConfirming(true)}>Apply</button>
            )}
            {chosen && confirming && (
              <>
                <span className="text-slate-700">Move {count} item{count === 1 ? '' : 's'} to “{chosen.label}”?</span>
                <button className="btn-primary" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Working…' : 'Yes, apply'}</button>
                <button className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
              </>
            )}
          </div>
          {chosen?.noteRequired && (
            <textarea className="input mt-3 min-h-[64px]" placeholder="Note (required): shown on every item" value={note} onChange={(e) => setNote(e.target.value)} />
          )}
          <p className="mt-2 text-xs text-slate-500">Each item is checked against the normal review rules; any that can’t move are skipped and listed. Approval is always done one item at a time.</p>
          {run.error && <div className="mt-2"><ErrorBox error={run.error} /></div>}
        </div>
      )}
    </>
  );
}
