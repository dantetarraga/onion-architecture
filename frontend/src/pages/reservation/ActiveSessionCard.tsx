import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatElapsed } from '@/lib/format';
import { useTicker } from '@/hooks/useTicker';
import { parkingApi } from '@/api/parking.api';
import { paymentsApi } from '@/api/payments.api';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { Branch, ParkingSession, PricingResult, Reservation } from '@/types/entities';

interface ActiveSessionCardProps {
  session: ParkingSession;
  reservation: Reservation;
  branch?: Branch;
  onChange: () => void;
}

export function ActiveSessionCard({ session, reservation, branch, onChange }: ActiveSessionCardProps) {
  const [amount, setAmount] = useState<PricingResult | null>(null);
  const [loadingAmount, setLoadingAmount] = useState(true);
  const [paying, setPaying] = useState(false);
  const now = useTicker();

  function loadAmount() {
    setLoadingAmount(true);
    parkingApi
      .amount(session.id)
      .then(setAmount)
      .catch((error) => notifyError(error))
      .finally(() => setLoadingAmount(false));
  }

  useEffect(loadAmount, [session.id]);

  const elapsedMs = now.getTime() - new Date(session.entryAt).getTime();

  async function handlePay() {
    setPaying(true);
    try {
      await paymentsApi.create(session.id);
      notifySuccess('Pago aprobado. Ya puedes registrar tu salida.');
      onChange();
    } catch (error) {
      notifyError(error);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-steel">Sesión activa · {branch?.name}</p>
        <p className="mt-1 font-display text-4xl text-asphalt">{formatElapsed(elapsedMs)}</p>
        <p className="mt-1 text-sm text-steel">Tiempo de permanencia</p>
      </div>

      <Card className="w-full max-w-sm p-5">
        <p className="font-mono text-xs uppercase tracking-wide text-steel">Monto a pagar</p>
        {loadingAmount || !amount ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <>
            <p className="mt-1 font-display text-3xl text-asphalt">{formatCurrency(amount.amount)}</p>
            <ul className="mt-3 flex flex-col gap-1 border-t border-dashed border-steel-100 pt-3">
              {amount.breakdown.map((item) => (
                <li key={item.label} className="flex justify-between font-mono text-xs text-steel">
                  <span>{item.label}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadAmount}>
            Actualizar
          </Button>
          <Button onClick={handlePay} loading={paying} className="flex-1">
            Pagar (mock)
          </Button>
        </div>
      </Card>

      <p className="max-w-xs text-center font-mono text-[11px] text-steel-300">
        Reserva {reservation.id.slice(0, 8).toUpperCase()} · el pago se aprueba automáticamente en este entorno de
        demostración
      </p>
    </div>
  );
}
