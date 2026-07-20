import { useEffect, useState } from 'react';
import { TicketStub } from '@/components/ui/TicketStub';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { generateQrDataUrl } from '@/lib/qrcode';
import { formatCurrency, formatElapsed } from '@/lib/format';
import { useTicker } from '@/hooks/useTicker';
import { parkingApi } from '@/api/parking.api';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { Branch, ParkingSession, Payment } from '@/types/entities';

interface ReadyToExitCardProps {
  session: ParkingSession;
  payment: Payment;
  branch?: Branch;
  onChange: () => void;
}

export function ReadyToExitCard({ session, payment, branch, onChange }: ReadyToExitCardProps) {
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const now = useTicker();

  useEffect(() => {
    parkingApi
      .exitQr(session.id)
      .then(async ({ qrPayload }) => {
        setQrPayload(qrPayload);
        setQrDataUrl(await generateQrDataUrl(qrPayload));
      })
      .catch((error) => notifyError(error));
  }, [session.id]);

  const elapsedMs = now.getTime() - new Date(session.entryAt).getTime();

  async function handleSimulateScan() {
    if (!qrPayload) return;
    setScanning(true);
    try {
      await parkingApi.registerExit(qrPayload);
      notifySuccess('Salida registrada. ¡Gracias por tu visita!');
      onChange();
    } catch (error) {
      notifyError(error);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-route-green-600">
          Pago aprobado · {branch?.name}
        </p>
        <p className="mt-1 font-display text-3xl text-asphalt">{formatElapsed(elapsedMs)}</p>
        <p className="mt-1 text-sm text-steel">Listo para salir</p>
      </div>

      {qrDataUrl ? (
        <TicketStub
          eyebrow="Ticket de salida"
          code={`#${payment.id.slice(0, 8).toUpperCase()}`}
          qrDataUrl={qrDataUrl}
          accent="green"
          rows={[
            { label: 'Monto pagado', value: formatCurrency(payment.amount) },
            { label: 'Referencia', value: payment.externalReference ?? '—' },
          ]}
          footnote="Muestra este código en la barrera de salida"
          action={
            <Button onClick={handleSimulateScan} loading={scanning} variant="secondary" className="w-full">
              Simular escaneo de salida
            </Button>
          }
        />
      ) : (
        <Spinner size={32} />
      )}
    </div>
  );
}
