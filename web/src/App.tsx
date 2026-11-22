import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReviewQueue from './pages/ReviewQueue';
import Dishes from './pages/Dishes';
import DishDetail from './pages/DishDetail';
import Foods from './pages/Foods';
import FoodDetail from './pages/FoodDetail';
import Account from './pages/Account';
import Users from './pages/Users';
import Audit from './pages/Audit';
import Export from './pages/Export';
import ReviewSheet from './pages/ReviewSheet';

function RequireAuth() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Spinner label="Signing you in…" />;
  if (!user) return <Navigate to="/login" replace />;
  // A temporary password must be replaced before anything else is usable (the API enforces this too).
  if (user.mustChangePassword && pathname !== '/account/password') return <Navigate to="/account/password" replace />;
  return <Layout />;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user?.role === 'SUPER_ADMIN' ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Dashboard />} />
        <Route path="review" element={<ReviewQueue />} />
        <Route path="dishes" element={<Dishes />} />
        <Route path="dishes/:id" element={<DishDetail />} />
        <Route path="foods" element={<Foods />} />
        <Route path="foods/:id" element={<FoodDetail />} />
        <Route path="export" element={<Export />} />
        <Route path="export/sheet" element={<ReviewSheet />} />
        <Route path="account/password" element={<Account />} />
        <Route path="users" element={<RequireAdmin><Users /></RequireAdmin>} />
        <Route path="audit" element={<RequireAdmin><Audit /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
