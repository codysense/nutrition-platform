import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { takeNotice } from '../lib/api';
import { ErrorBox } from '../components/ui';
import { PasswordInput } from '../components/PasswordInput';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice] = useState(() => takeNotice());

  // Free hosting sleeps when idle, so the first sign-in can take a while. Say so instead of looking frozen.
  useEffect(() => {
    if (!busy) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [busy]);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold text-brand-700">Nutrition Back Office</h1>
          <p className="text-sm text-slate-500">Sign in to manage and review food data.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={setPassword} />
        </div>
        {notice && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
        {slow && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">Still working. The server may be waking up after being idle, which can take up to a minute.</p>}
        {error != null && <ErrorBox error={error} />}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
