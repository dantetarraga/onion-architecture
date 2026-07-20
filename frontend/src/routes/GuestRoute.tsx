import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

/** Keeps already-authenticated users out of /login and /register. */
export function GuestRoute() {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <Navigate to="/sucursales" replace />;
  }

  return <Outlet />;
}
