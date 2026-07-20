import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection';
import { cn } from '@/lib/cn';
import { ToastViewport } from '@/components/ui/ToastViewport';

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  cn(
    'border-b-2 px-1 py-4 font-mono text-xs uppercase tracking-wide transition-colors',
    isActive ? 'border-signal-yellow text-paper' : 'border-transparent text-steel-300 hover:text-paper',
  );

export function AppShell() {
  useRealtimeConnection();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-concrete">
      <header className="bg-asphalt">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2 py-4">
              <span className="h-3 w-3 bg-signal-yellow" aria-hidden />
              <span className="font-display text-lg tracking-wide text-paper">Parking/OS</span>
            </div>
            <nav className="flex items-center gap-6">
              <NavLink to="/sucursales" className={NAV_LINK_CLASS}>
                Sucursales
              </NavLink>
              <NavLink to="/mi-reserva" className={NAV_LINK_CLASS}>
                Mi reserva
              </NavLink>
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin" className={NAV_LINK_CLASS}>
                  Administración
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4 py-4">
            <span className="hidden font-mono text-xs text-steel-300 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="font-mono text-xs uppercase tracking-wide text-steel-300 hover:text-signal-yellow"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <div className="h-1 bg-signal-yellow" aria-hidden />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>

      <ToastViewport />
    </div>
  );
}
