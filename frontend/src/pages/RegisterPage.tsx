import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/api/auth.api';
import { notifyError, notifySuccess } from '@/lib/notify';

export function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await authApi.register({ fullName, email, password });
      notifySuccess('Cuenta creada. Ahora inicia sesión.');
      navigate('/login', { replace: true });
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Registro"
      title="Crear cuenta"
      footer={
        <span>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-signal-yellow-600 hover:text-signal-yellow">
            Inicia sesión
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nombre completo"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Crear cuenta
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-steel-100" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-300">o</span>
        <span className="h-px flex-1 bg-steel-100" />
      </div>

      <GoogleAuthButton />
    </AuthLayout>
  );
}
