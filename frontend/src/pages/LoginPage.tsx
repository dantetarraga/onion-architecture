import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { notifyError } from '@/lib/notify';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      setAuth(result.accessToken, result.user);
      const from = (location.state as { from?: string } | null)?.from ?? '/sucursales';
      navigate(from, { replace: true });
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Acceso"
      title="Iniciar sesión"
      footer={
        <span>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-signal-yellow-600 hover:text-signal-yellow">
            Regístrate
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Correo"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Ingresar
        </Button>
      </form>
    </AuthLayout>
  );
}
