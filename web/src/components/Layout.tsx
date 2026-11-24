import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';
import { Queue } from '../lib/types';

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium lg:py-2 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const forced = !!user?.mustChangePassword; // only the change-password screen is usable until this is done
  const queue = useQuery({ queryKey: ['queue'], queryFn: () => api<Queue>('/admin/review/queue'), enabled: !forced });
  const waiting = (queue.data?.recipes.length ?? 0) + (queue.data?.foods.length ?? 0);

  // Phones: the menu is a slide-out drawer. Close it after navigating, on Escape, and stop the page scrolling behind it.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:flex print:block">
      {/* Top bar: phones and tablets only */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:hidden print:hidden">
        <button
          type="button" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="app-menu"
          className="-ml-2 rounded-md p-2 text-slate-700 hover:bg-slate-100" onClick={() => setMenuOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <p className="flex-1 truncate font-semibold text-brand-700">Nutrition Back Office</p>
        {!forced && waiting > 0 && (
          <Link to="/review" className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{waiting} to review</Link>
        )}
      </header>

      {menuOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden print:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside
        id="app-menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 bg-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] transition-transform lg:static lg:z-auto lg:w-60 lg:max-w-none lg:shrink-0 lg:translate-x-0 print:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full invisible lg:visible'}`}
      >
        <div className="mb-6 flex items-start justify-between px-2">
          <div>
            <p className="text-base font-semibold text-brand-700">Nutrition Back Office</p>
            <p className="text-xs text-slate-500">Nigerian food knowledge base</p>
          </div>
          <button type="button" aria-label="Close menu" className="-mr-2 rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
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

            {user?.role === 'SUPER_ADMIN' && (
              <>
                <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Administration</p>
              <NavLink to="/export" className={link}>Export</NavLink>
                <NavLink to="/users" className={link}>Users</NavLink>
                <NavLink to="/audit" className={link}>Audit log</NavLink>
              </>
            )}
          </nav>
        )}
        <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
          <p className="font-medium text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user && ROLE_LABEL[user.role]}</p>
          {!forced && <Link to="/account/password" className="mt-2 block py-1 text-xs text-brand-600 hover:underline">Change password</Link>}
          <button className="btn-secondary mt-3 w-full" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8 print:p-0"><Outlet /></main>
    </div>
  );
}
