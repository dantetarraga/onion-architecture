import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { FacebookAuthButton } from '@/components/auth/FacebookAuthButton';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/api/auth.api';
import { useLoginResult } from '@/hooks/useLoginResult';
import { notifyError } from '@/lib/notify';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLoginResult = useLoginResult();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      handleLoginResult(await authApi.login({ email, password }));
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

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-steel-100" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-300">o</span>
        <span className="h-px flex-1 bg-steel-100" />
      </div>

      <div className="flex flex-col gap-3">
        <GoogleAuthButton />
        <FacebookAuthButton />
      </div>
    </AuthLayout>
  );
}
