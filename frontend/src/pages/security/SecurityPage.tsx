import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { authApi } from '@/api/auth.api';
import { usersApi } from '@/api/users.api';
import { generateQrDataUrl } from '@/lib/qrcode';
import { notifyError, notifySuccess } from '@/lib/notify';

/**
 * Activacion / desactivacion de la verificacion en dos pasos.
 * Estados: idle -> (setup) scanning -> (confirm) backup -> idle(enabled)
 *          idle(enabled) -> (disable) idle
 */
type Step = 'loading' | 'idle' | 'scanning' | 'backup';

export function SecurityPage() {
  const [step, setStep] = useState<Step>('loading');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string; qrDataUrl: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const loadStatus = useCallback(() => {
    usersApi
      .me()
      .then((me) => {
        setMfaEnabled(Boolean(me.mfaEnabled));
        setStep('idle');
      })
      .catch((error) => notifyError(error));
  }, []);

  useEffect(loadStatus, [loadStatus]);

  async function handleStartSetup() {
    setBusy(true);
    try {
      const result = await authApi.setupMfa();
      setSetup({ ...result, qrDataUrl: await generateQrDataUrl(result.otpauthUri) });
      setCode('');
      setStep('scanning');
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await authApi.confirmMfa(code);
      setBackupCodes(result.backupCodes);
      setMfaEnabled(true);
      setCode('');
      setStep('backup');
      notifySuccess('Verificación en dos pasos activada.');
    } catch (error) {
      notifyError(error);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await authApi.disableMfa(code);
      setMfaEnabled(false);
      setCode('');
      notifySuccess('Verificación en dos pasos desactivada.');
    } catch (error) {
      notifyError(error);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Seguridad"
        title="Verificación en dos pasos"
        subtitle="Además de tu contraseña, pediremos un código de 6 dígitos generado por Google Authenticator (o cualquier app compatible) cada vez que inicies sesión."
      />

      <Card railColor={mfaEnabled ? 'green' : 'yellow'} className="max-w-2xl p-6">
        {step === 'idle' && !mfaEnabled && (
          <div className="flex flex-col gap-4">
            <StatusLine enabled={false} />
            <ol className="list-decimal space-y-1 pl-5 text-sm text-steel">
              <li>Instala Google Authenticator en tu celular (no necesitas cuenta de Google).</li>
              <li>Escanea el código QR que te mostraremos.</li>
              <li>Escribe el código que aparece en la app para confirmar.</li>
            </ol>
            <Button onClick={handleStartSetup} loading={busy} className="self-start">
              Activar
            </Button>
          </div>
        )}

        {step === 'scanning' && setup && (
          <form onSubmit={handleConfirm} className="flex flex-col gap-5">
            <p className="text-sm text-steel">
              Escanea este código con Google Authenticator. Si no puedes escanear, agrega una cuenta
              manualmente con la clave de abajo.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img
                src={setup.qrDataUrl}
                alt="Código QR para Google Authenticator"
                className="h-48 w-48 border border-steel-100"
              />
              <div className="flex-1">
                <p className="font-mono text-xs uppercase tracking-wide text-steel">Clave manual</p>
                <p className="mt-1 break-all font-mono text-sm text-asphalt">{formatSecret(setup.secret)}</p>
                <p className="mt-3 font-mono text-xs text-steel-300">
                  Tipo: basado en tiempo · 6 dígitos · 30 s
                </p>
              </div>
            </div>
            <Input
              label="Código de la app"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              className="max-w-xs text-center font-mono text-xl tracking-[0.4em]"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
            <div className="flex gap-3">
              <Button type="submit" loading={busy}>
                Confirmar y activar
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep('idle')}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {step === 'backup' && (
          <div className="flex flex-col gap-4">
            <StatusLine enabled />
            <p className="text-sm text-steel">
              Guarda estos códigos de respaldo en un lugar seguro. Si pierdes el celular, cada uno te permite
              entrar <strong>una sola vez</strong>. No los volveremos a mostrar.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-sm bg-concrete-200 p-4 font-mono text-sm text-asphalt sm:grid-cols-4">
              {backupCodes.map((backupCode) => (
                <li key={backupCode}>{backupCode}</li>
              ))}
            </ul>
            <Button onClick={() => setStep('idle')} className="self-start">
              Ya los guardé
            </Button>
          </div>
        )}

        {step === 'idle' && mfaEnabled && (
          <form onSubmit={handleDisable} className="flex flex-col gap-4">
            <StatusLine enabled />
            <p className="text-sm text-steel">
              Para desactivarla, confirma con el código actual de tu app. Así una sesión abierta en otro
              dispositivo no puede apagarla sin tu celular.
            </p>
            <Input
              label="Código de la app"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              className="max-w-xs text-center font-mono text-xl tracking-[0.4em]"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
            <Button type="submit" variant="danger" loading={busy} className="self-start">
              Desactivar
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

function StatusLine({ enabled }: { enabled: boolean }) {
  return (
    <p className="font-mono text-xs uppercase tracking-wide">
      Estado:{' '}
      <span className={enabled ? 'text-route-green' : 'text-signal-yellow-600'}>
        {enabled ? 'Activada' : 'Desactivada'}
      </span>
    </p>
  );
}

/** Agrupa la clave base32 de a 4 para que se pueda leer y teclear sin perderse. */
function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}
