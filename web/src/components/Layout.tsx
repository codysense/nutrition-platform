import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';
import { Queue } from '../lib/types';

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { user, logout } = useAuth();
  const forced = !!user?.mustChangePassword; // only the change-password screen is usable until this is done
  const queue = useQuery({ queryKey: ['queue'], queryFn: () => api<Queue>('/admin/review/queue'), enabled: !forced });
  const waiting = (queue.data?.recipes.length ?? 0) + (queue.data?.foods.length ?? 0);

  return (
    <div className="flex min-h-screen print:block">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 print:hidden">
        <div className="mb-6 px-2">
          <p className="text-base font-semibold text-brand-700">Nutrition Back Office</p>
          <p className="text-xs text-slate-500">Nigerian food knowledge base</p>
        </div>
        {!forced && (
          <nav className="space-y-1">
            <NavLink to="/" end className={link}>Overview</NavLink>
            <NavLink to="/review" className={link}>
              Review queue
              {waiting > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{waiting}</span>}
            </NavLink>
            <NavLink to="/dishes" className={link}>Dishes</NavLink>
            <NavLink to="/foods" className={link}>Foodstuffs</NavLink>
            <NavLink to="/export" className={link}>Export</NavLink>
            {user?.role === 'SUPER_ADMIN' && (
              <>
                <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Administration</p>
                <NavLink to="/users" className={link}>Users</NavLink>
                <NavLink to="/audit" className={link}>Audit log</NavLink>
              </>
            )}
          </nav>
        )}
        <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
          <p className="font-medium text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user && ROLE_LABEL[user.role]}</p>
          {!forced && <Link to="/account/password" className="mt-2 block text-xs text-brand-600 hover:underline">Change password</Link>}
          <button className="btn-secondary mt-3 w-full" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8 print:p-0"><Outlet /></main>
    </div>
  );
}
