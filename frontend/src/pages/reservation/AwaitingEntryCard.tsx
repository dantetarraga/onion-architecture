import { useEffect, useState } from 'react';
import { TicketStub } from '@/components/ui/TicketStub';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { generateQrDataUrl } from '@/lib/qrcode';
import { formatCountdown, formatDateTime } from '@/lib/format';
import { useTicker } from '@/hooks/useTicker';
import { parkingApi } from '@/api/parking.api';
import { reservationsApi } from '@/api/reservations.api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { SLOT_TYPE_LABEL } from '@/types/enums';
import type { Branch, Reservation } from '@/types/entities';

interface AwaitingEntryCardProps {
  reservation: Reservation;
  branch?: Branch;
  onChange: () => void;
}

export function AwaitingEntryCard({ reservation, branch, onChange }: AwaitingEntryCardProps) {
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const now = useTicker();

  useEffect(() => {
    parkingApi
      .entryQr(reservation.id)
      .then(async ({ qrPayload }) => {
        setQrPayload(qrPayload);
        setQrDataUrl(await generateQrDataUrl(qrPayload));
      })
      .catch((error) => notifyError(error));
  }, [reservation.id]);

  const msRemaining = new Date(reservation.expiresAt).getTime() - now.getTime();
  const expired = msRemaining <= 0;

  async function handleSimulateScan() {
    if (!qrPayload) return;
    setScanning(true);
    try {
      await parkingApi.registerEntry(qrPayload);
      notifySuccess('Ingreso registrado. El contador de permanencia empezó a correr.');
      onChange();
    } catch (error) {
      notifyError(error);
    } finally {
      setScanning(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await reservationsApi.cancel(reservation.id);
      notifySuccess('Reserva cancelada.');
      onChange();
    } catch (error) {
      notifyError(error);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-steel">Reserva pendiente de ingreso</p>
        <p className={`mt-1 font-display text-3xl ${expired ? 'text-hazard-red' : 'text-asphalt'}`}>
          {expired ? 'Ventana vencida' : formatCountdown(msRemaining)}
        </p>
        <p className="mt-1 text-sm text-steel">
          {expired
            ? 'La reserva expirará automáticamente; el sistema la liberará en breve.'
            : 'Tiempo restante para presentar el QR de ingreso'}
        </p>
      </div>

      {qrDataUrl ? (
        <TicketStub
          eyebrow="Ticket de ingreso"
          code={`#${reservation.id.slice(0, 8).toUpperCase()}`}
          qrDataUrl={qrDataUrl}
          accent="yellow"
          rows={[
            { label: 'Sucursal', value: branch?.name ?? '—' },
            { label: 'Tipo de cochera', value: SLOT_TYPE_LABEL[reservation.requestedType] },
            { label: 'Vence', value: formatDateTime(reservation.expiresAt) },
          ]}
          footnote="Muestra este código al llegar a la sucursal"
          action={
            <Button onClick={handleSimulateScan} loading={scanning} disabled={expired} className="w-full">
              Simular escaneo de ingreso
            </Button>
          }
        />
      ) : (
        <Spinner size={32} />
      )}

      <Button variant="ghost" size="sm" onClick={handleCancel} loading={cancelling}>
        Cancelar reserva
      </Button>
    </div>
  );
}
