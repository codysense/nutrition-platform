import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { basePath, useInvalidate } from '../lib/hooks';
import { fmtDate, ROLE_LABEL, titleCase } from '../lib/format';
import { Comment, Kind } from '../lib/types';
import { ErrorBox } from './ui';

export function CommentThread({ kind, id, comments, fields, focusField, canComment }: {
  kind: Kind; id: string; comments: Comment[]; fields: { key: string; label: string }[];
  focusField: string | null; canComment: boolean;
}) {
  const invalidate = useInvalidate();
  const [body, setBody] = useState('');
  const [field, setField] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  // Clicking "Comment" next to a field pre-selects it here.
  useEffect(() => {
    if (focusField) setField(focusField);
  }, [focusField]);

  const add = useMutation({
    mutationFn: () => api(`${basePath(kind)}/${id}/comments`, { method: 'POST', body: { body, field: field || undefined } }),
    onSuccess: async () => { setBody(''); await invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; resolved: boolean }) => api(`/admin/review/comments/${v.id}`, { method: 'PATCH', body: { resolved: v.resolved } }),
    onSuccess: invalidate,
  });

  const labelFor = (key: string | null) => fields.find((f) => f.key === key)?.label ?? titleCase(key);
  const open = comments.filter((c) => !c.resolved && c.field !== 'status');
  const history = comments.filter((c) => c.resolved || c.field === 'status');
  const shown = showResolved ? [...open, ...history] : open;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Comments {open.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 text-xs text-amber-800">{open.length} open</span>}</h2>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show history
        </label>
      </div>

      <ul className="mb-4 max-h-[420px] space-y-3 overflow-y-auto">
        {shown.length === 0 && <li className="text-sm text-slate-500">No open comments.</li>}
        {shown.map((c) => (
          <li key={c.id} className={`rounded-md border p-3 text-sm ${c.field === 'status' ? 'border-slate-200 bg-slate-50 italic text-slate-600' : c.resolved ? 'border-slate-200 bg-white text-slate-500' : 'border-amber-200 bg-amber-50'}`}>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{c.author.name}</span>
              <span>{ROLE_LABEL[c.author.role]}</span>
              <span>{fmtDate(c.createdAt)}</span>
              {c.field && c.field !== 'status' && <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">on {labelFor(c.field)}</span>}
            </div>
            <p className="whitespace-pre-wrap">{c.body}</p>
            {canComment && c.field !== 'status' && (
              <button className="mt-2 text-xs font-medium text-brand-600 hover:underline" onClick={() => toggle.mutate({ id: c.id, resolved: !c.resolved })}>
                {c.resolved ? 'Reopen' : 'Mark resolved'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {canComment ? (
        <div className="space-y-2">
          <select className="input" value={field} onChange={(e) => setField(e.target.value)}>
            <option value="">General comment</option>
            {fields.map((f) => <option key={f.key} value={f.key}>On: {f.label}</option>)}
          </select>
          <textarea className="input min-h-[80px]" placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn-primary" disabled={!body.trim() || add.isPending} onClick={() => add.mutate()}>Add comment</button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Viewers can read but not comment.</p>
      )}
      {(add.error || toggle.error) && <div className="mt-3"><ErrorBox error={add.error ?? toggle.error} /></div>}
    </div>
  );
}
