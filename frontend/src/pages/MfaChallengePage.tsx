import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/api/auth.api';
import { useLoginResult } from '@/hooks/useLoginResult';
import { notifyError } from '@/lib/notify';

interface MfaLocationState {
  mfaToken?: string;
  from?: string;
}

/**
 * Segundo paso del login. Solo se llega aqui desde un login que respondio
 * `mfaRequired: true`; el mfaToken viaja en el state del router, asi que
 * recargar la pagina lo pierde y hay que volver a ingresar (es a proposito:
 * el token dura 5 min y no queremos persistirlo).
 */
export function MfaChallengePage() {
  const location = useLocation();
  const state = (location.state as MfaLocationState | null) ?? {};
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleLoginResult = useLoginResult();

  if (!state.mfaToken) {
    return <Navigate to="/login" replace />;
  }
  const mfaToken = state.mfaToken;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      handleLoginResult(await authApi.verifyMfa(mfaToken, code));
    } catch (error) {
      notifyError(error);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Verificación en dos pasos"
      title={useBackup ? 'Código de respaldo' : 'Ingresa el código'}
      footer={
        <Link to="/login" className="text-signal-yellow-600 hover:text-signal-yellow">
          Volver a iniciar sesión
        </Link>
      }
    >
      <p className="mb-5 text-sm text-steel">
        {useBackup
          ? 'Usa uno de los códigos de respaldo que guardaste al activar la verificación. Cada código sirve una sola vez.'
          : 'Abre Google Authenticator (o tu app de códigos) y escribe el código de 6 dígitos de Parking/OS.'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={useBackup ? 'Código de respaldo' : 'Código de 6 dígitos'}
          inputMode={useBackup ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder={useBackup ? 'XXXX-XXXX' : '123456'}
          maxLength={useBackup ? 9 : 6}
          pattern={useBackup ? undefined : '[0-9]{6}'}
          className="text-center font-mono text-2xl tracking-[0.4em]"
          value={code}
          onChange={(event) =>
            setCode(useBackup ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ''))
          }
        />
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Verificar
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseBackup((value) => !value);
          setCode('');
        }}
        className="mt-5 w-full text-center font-mono text-xs uppercase tracking-wide text-steel-300 hover:text-asphalt"
      >
        {useBackup ? 'Usar el código de la app' : '¿Perdiste el celular? Usar código de respaldo'}
      </button>
    </AuthLayout>
  );
}
