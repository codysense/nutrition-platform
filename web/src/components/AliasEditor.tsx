import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { basePath, useInvalidate } from '../lib/hooks';
import { Alias, Kind } from '../lib/types';
import { titleCase } from '../lib/format';
import { ErrorBox } from './ui';

const LANGS = ['yoruba', 'hausa', 'igbo', 'english', 'other'];

/** Local names with a per-name "verified by a native speaker" flag that only reviewers can set. */
export function AliasEditor({ kind, id, aliases, canEdit, isReviewer }: {
  kind: Kind; id: string; aliases: Alias[]; canEdit: boolean; isReviewer: boolean;
}) {
  const invalidate = useInvalidate();
  const [language, setLanguage] = useState('yoruba');
  const [name, setName] = useState('');

  const clean = (list: Alias[]) => list.map((a) => ({ language: a.language, name: a.name, verified: a.verified }));
  const save = useMutation({
    mutationFn: (list: Alias[]) => api(`${basePath(kind)}/${id}/aliases`, { method: 'PUT', body: { aliases: clean(list) } }),
    onSuccess: invalidate,
  });

  return (
    <section className="card">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Local names</h2>
        <p className="text-xs text-slate-500">Names are unverified until a native speaker confirms them.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {aliases.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No local names recorded.</li>}
        {aliases.map((a, i) => (
          <li key={`${a.language}-${a.name}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <span><span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{titleCase(a.language)}</span>{a.name}</span>
            <span className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={a.verified} disabled={!isReviewer || save.isPending}
                  onChange={(e) => save.mutate(aliases.map((x, j) => (j === i ? { ...x, verified: e.target.checked } : x)))} />
                Verified
              </label>
              {canEdit && <button className="text-xs text-red-600 hover:underline" onClick={() => save.mutate(aliases.filter((_, j) => j !== i))}>Remove</button>}
            </span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row">
          <select className="input sm:max-w-[130px]" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGS.map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}
          </select>
          <input className="input" placeholder="Add a local name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-secondary" disabled={!name.trim() || save.isPending}
            onClick={() => { save.mutate([...aliases, { language, name: name.trim(), verified: false }]); setName(''); }}>Add</button>
        </div>
      )}
      {save.error && <div className="p-3"><ErrorBox error={save.error} /></div>}
    </section>
  );
}
