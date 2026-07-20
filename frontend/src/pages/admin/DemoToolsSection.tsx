import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/api/admin.api';
import { notifyError, notifySuccess } from '@/lib/notify';

export function DemoToolsSection() {
  const [expiring, setExpiring] = useState(false);

  async function handleExpireNow() {
    setExpiring(true);
    try {
      await adminApi.expireNow();
      notifySuccess('Se procesaron las reservas vencidas.');
    } catch (error) {
      notifyError(error);
    } finally {
      setExpiring(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h3 className="text-base text-asphalt">Forzar expiración de reservas</h3>
        <p className="text-sm text-steel">
          Ejecuta ahora la misma rutina que corre el cron cada minuto, sin esperar la ventana de tolerancia.
        </p>
      </div>
      <Button variant="outline" onClick={handleExpireNow} loading={expiring}>
        Ejecutar ahora
      </Button>
    </Card>
  );
}
