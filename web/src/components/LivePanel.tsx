import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useInvalidate } from '../lib/hooks';
import { fmtDate, lineReady } from '../lib/format';
import { Dish } from '../lib/types';
import { ErrorBox } from './ui';

/**
 * What the public sees for this dish. The working copy and the live version are separate: editing a live dish
 * does not change what visitors see until the new version is approved and published.
 */
export function LivePanel({ dish, canEdit }: { dish: Dish; canEdit: boolean }) {
  const invalidate = useInvalidate();
  const [confirming, setConfirming] = useState(false);
  const live = dish.live ?? null;
  const versions = dish.versions ?? [];
  const total = dish.lines.length;
  const confirmed = dish.lines.filter(lineReady).length;
  const pct = total ? Math.round((confirmed / total) * 100) : 0;

  const republish = useMutation({
    mutationFn: () => api(`/admin/dishes/${dish.id}/republish`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const offline = useMutation({
    mutationFn: () => api(`/admin/dishes/${dish.id}/unpublish`, { method: 'POST' }),
    onSuccess: async () => { setConfirming(false); await invalidate(); },
  });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Public visibility</h2>
        {live ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Live · v{live.version}</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Not live</span>
        )}
      </div>

      {live ? (
        <p className="text-sm text-slate-600">
          Version {live.version} went live {fmtDate(live.publishedAt)}.
          {live.approvedAt && <> Approved {fmtDate(live.approvedAt)}.</>}
        </p>
      ) : (
        <p className="text-sm text-slate-600">Visitors cannot see this dish. It becomes public when it is approved and then published.</p>
      )}

      {live?.hasUnpublishedChanges && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The working copy has changes that are <strong>not live yet</strong>. Visitors still see version {live.version}. Approve the changes and publish to update it.
        </p>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Ingredient lines confirmed</span>
          <span>{confirmed} of {total} ({pct}%)</span>
        </div>
        <div className="mt-1 h-2 rounded bg-slate-100"><div className={`h-2 rounded ${pct === 100 ? 'bg-brand-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} /></div>
        {pct < 100 && <p className="mt-1 text-xs text-slate-500">{total - confirmed} line{total - confirmed === 1 ? '' : 's'} left to confirm. A dish cannot go live until every ingredient line is confirmed.</p>}
      </div>

      {canEdit && live?.hasUnpublishedChanges && dish.status === 'PUBLISHED' && (
        <div className="mt-3">
          <button className="btn-primary" disabled={republish.isPending || pct < 100} onClick={() => republish.mutate()}>Publish update (go live)</button>
          <p className="mt-1 text-xs text-slate-500">These changes are to ingredient links or roles, not reviewed claims, so no new approval is needed.</p>
        </div>
      )}
      {republish.error && <div className="mt-3"><ErrorBox error={republish.error} /></div>}

      {canEdit && live && (
        <div className="mt-4">
          {!confirming ? (
            <button className="btn-secondary" onClick={() => setConfirming(true)}>Take offline</button>
          ) : (
            <div className="space-y-2 rounded-md bg-slate-50 p-3 text-sm">
              <p>Take version {live.version} offline? Visitors will no longer see this dish. Its review status does not change.</p>
              <div className="flex gap-2">
                <button className="btn-danger" disabled={offline.isPending} onClick={() => offline.mutate()}>Yes, take offline</button>
                <button className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {offline.error && <div className="mt-3"><ErrorBox error={offline.error} /></div>}

      {versions.length > 0 && (
        <details className="mt-4 text-xs text-slate-600">
          <summary className="cursor-pointer select-none font-medium">Version history</summary>
          <ul className="mt-2 space-y-1">
            {versions.map((v) => (
              <li key={v.version} className="flex justify-between gap-3">
                <span>v{v.version} · published {fmtDate(v.publishedAt)}</span>
                <span className={v.retiredAt ? 'text-slate-400' : 'font-medium text-green-700'}>{v.retiredAt ? 'retired' : 'live'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
