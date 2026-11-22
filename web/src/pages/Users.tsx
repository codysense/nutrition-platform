import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { generatePassword } from '../lib/password';
import { ROLE_LABEL, fmtDate } from '../lib/format';
import { Role, UserRow } from '../lib/types';
import { ErrorBox, PageHeader, Spinner } from '../components/ui';

const ROLES = Object.keys(ROLE_LABEL) as Role[];

/** Shown once after creating a user or resetting a password: the temporary password is never stored in plain text. */
function Credentials({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${email}\nTemporary password: ${password}`;
  return (
    <div className="card mb-5 border-l-4 border-l-amber-500 p-4 text-sm">
      <p className="font-medium">Share these sign-in details securely. This is the only time the password is shown.</p>
      <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-sm">{text}</pre>
      <p className="mt-2 text-xs text-slate-500">They will be asked to choose their own password at first sign-in.</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary" onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(true)); }}>{copied ? 'Copied' : 'Copy'}</button>
        <button className="btn-primary" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api<UserRow[]>('/admin/users') });
  const [form, setForm] = useState({ name: '', email: '', role: 'NUTRITION_REVIEWER' as Role, password: generatePassword() });
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () => api<UserRow>('/admin/users', { method: 'POST', body: form }),
    onSuccess: async (u) => {
      setCreds({ email: u.email, password: form.password });
      setForm({ name: '', email: '', role: 'NUTRITION_REVIEWER', password: generatePassword() });
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => api<UserRow>(`/admin/users/${v.id}`, { method: 'PATCH', body: v.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const reset = (u: UserRow) => {
    const password = generatePassword();
    patch.mutate({ id: u.id, body: { password } }, { onSuccess: () => setCreds({ email: u.email, password }) });
  };

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader title="Users" subtitle="Create accounts for your team and the dietitian. New accounts get a temporary password that must be changed at first sign-in." />
      {creds && <Credentials {...creds} onDone={() => setCreds(null)} />}

      <section className="card mb-5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a user</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_1fr_auto]">
          <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <div className="flex gap-2">
            <input className="input font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button className="btn-secondary" type="button" onClick={() => setForm({ ...form, password: generatePassword() })}>New</button>
          </div>
          <button className="btn-primary" disabled={create.isPending || !form.name.trim() || !form.email.trim() || form.password.length < 12} onClick={() => create.mutate()}>Create</button>
        </div>
        {create.error && <div className="mt-3"><ErrorBox error={create.error} /></div>}
      </section>

      {patch.error && <div className="mb-4"><ErrorBox error={patch.error} /></div>}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50"><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Active</th><th className="th">Created</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id} className={u.isActive ? '' : 'bg-slate-50 text-slate-400'}>
                  <td className="td font-medium">{u.name}{self && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}{u.mustChangePassword && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">Temporary password</span>}</td>
                  <td className="td">{u.email}</td>
                  <td className="td">
                    <select className="input w-auto" value={u.role} disabled={self || patch.isPending} onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value } })}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="td"><input type="checkbox" checked={u.isActive} disabled={self || patch.isPending} onChange={(e) => patch.mutate({ id: u.id, body: { isActive: e.target.checked } })} aria-label={`Active: ${u.name}`} /></td>
                  <td className="td text-xs">{fmtDate(u.createdAt)}</td>
                  <td className="td text-right"><button className="btn-secondary" disabled={patch.isPending} onClick={() => reset(u)}>Reset password</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
