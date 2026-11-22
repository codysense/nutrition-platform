import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { UserError } from '../lib/apiError';
import { PasswordInput } from '../components/PasswordInput';
import { ErrorBox, PageHeader } from '../components/ui';

export default function Account() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const forced = !!user?.mustChangePassword;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) return setError(new UserError('The new password and its confirmation do not match.'));
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      await refreshUser();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Change password" />
      {forced && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You are using a temporary password. Choose a new one to continue.
        </p>
      )}
      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="cur">{forced ? 'Temporary password' : 'Current password'}</label>
          <PasswordInput id="cur" autoComplete="current-password" required value={current} onChange={setCurrent} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="new">New password</label>
          <PasswordInput id="new" autoComplete="new-password" required minLength={12} value={next} onChange={setNext} />
          <p className="mt-1 text-xs text-slate-500">At least 12 characters. A few random words is easier to remember than symbols.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="conf">Confirm new password</label>
          <PasswordInput id="conf" autoComplete="new-password" required value={confirm} onChange={setConfirm} />
        </div>
        {error != null && <ErrorBox error={error} />}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
