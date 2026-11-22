import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { basePath, useInvalidate } from '../lib/hooks';
import { Comment, Kind, ReviewStatus } from '../lib/types';
import { titleCase } from '../lib/format';
import { ErrorBox } from './ui';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'list';
  options?: string[]; // for select
  enumLabels?: boolean; // show options through titleCase (Prisma enums)
}

type Row = Record<string, unknown>;

const toInput = (v: unknown, f: FieldDef) => (f.type === 'list' ? ((v as string[] | null) ?? []).join('; ') : v == null ? '' : String(v));

function toValue(raw: string, f: FieldDef): unknown {
  const t = raw.trim();
  if (f.type === 'list') return t ? t.split(';').map((x) => x.trim()).filter(Boolean) : [];
  if (f.type === 'number') return t === '' ? null : Number(t);
  return t === '' ? null : t;
}

export function EditableFields({ title, kind, id, status, data, fields, canEdit, comments, onComment }: {
  title: string; kind: Kind; id: string; status: ReviewStatus; data: Row; fields: FieldDef[];
  canEdit: boolean; comments: Comment[]; onComment: (field: string) => void;
}) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (patch: Row) => api(`${basePath(kind)}/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: async () => { setEditing(false); await invalidate(); },
  });

  const start = () => {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, toInput(data[f.key], f)])));
    setEditing(true);
  };

  const submit = () => {
    const patch: Row = {};
    for (const f of fields) {
      if (draft[f.key] === toInput(data[f.key], f)) continue; // unchanged
      const v = toValue(draft[f.key], f);
      if (f.key === 'name' || f.key === 'category') { if (v === null) continue; } // required fields
      patch[f.key] = v;
    }
    if (Object.keys(patch).length === 0) return setEditing(false);
    save.mutate(patch);
  };

  const openFor = (key: string) => comments.filter((c) => c.field === key && !c.resolved).length;
  const willReset = status === 'APPROVED' || status === 'PUBLISHED';

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {canEdit && !editing && status !== 'ARCHIVED' && <button className="btn-secondary" onClick={start}>Edit</button>}
      </div>

      {editing && willReset && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          This content is {status.toLowerCase()}. Saving changes sends it back to “Pending review” so a dietitian can re-check it.
        </p>
      )}

      <dl className="divide-y divide-slate-100">
        {fields.map((f) => (
          <div key={f.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]">
            <dt className="flex items-start gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span>{f.label}</span>
              {!editing && (
                <button className="normal-case text-brand-600 hover:underline" onClick={() => onComment(f.key)} title="Comment on this field">
                  Comment{openFor(f.key) > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-amber-800">{openFor(f.key)}</span>}
                </button>
              )}
            </dt>
            <dd className="text-sm text-slate-800">
              {editing ? (
                f.type === 'textarea' ? (
                  <textarea className="input min-h-[90px]" value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                ) : f.type === 'select' ? (
                  <select className="input" value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                    <option value="">—</option>
                    {f.options!.map((o) => <option key={o} value={o}>{f.enumLabels ? titleCase(o) : o}</option>)}
                  </select>
                ) : (
                  <>
                    <input className="input" type={f.type === 'number' ? 'number' : 'text'} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                    {f.type === 'list' && <span className="text-xs text-slate-500">Separate items with “;”</span>}
                  </>
                )
              ) : f.type === 'list' ? (
                (data[f.key] as string[] | null)?.length ? (
                  <div className="flex flex-wrap gap-1">{(data[f.key] as string[]).map((x) => <span key={x} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{x}</span>)}</div>
                ) : <span className="text-slate-400">None</span>
              ) : data[f.key] == null || data[f.key] === '' ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span className="whitespace-pre-wrap">{f.enumLabels ? titleCase(String(data[f.key])) : String(data[f.key])}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {editing && (
        <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
          <button className="btn-primary" disabled={save.isPending} onClick={submit}>Save changes</button>
          <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          {save.error && <ErrorBox error={save.error} />}
        </div>
      )}
    </section>
  );
}
