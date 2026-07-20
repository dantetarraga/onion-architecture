import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { usersApi } from '@/api/users.api';
import { branchesApi } from '@/api/branches.api';
import { notifyError } from '@/lib/notify';
import type { Branch, ParkingSession, Payment, Reservation } from '@/types/entities';
import { AwaitingEntryCard } from './AwaitingEntryCard';
import { ActiveSessionCard } from './ActiveSessionCard';
import { ReadyToExitCard } from './ReadyToExitCard';

interface LoadedData {
  reservations: Reservation[];
  sessions: ParkingSession[];
  payments: Payment[];
  branchesById: Record<string, Branch>;
}

export function MyReservationPage() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([usersApi.myReservations(), usersApi.mySessions(), usersApi.myPayments(), branchesApi.list()])
      .then(([reservations, sessions, payments, branches]) => {
        setData({
          reservations,
          sessions,
          payments,
          branchesById: Object.fromEntries(branches.map((branch) => [branch.id, branch])),
        });
      })
      .catch((error) => notifyError(error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  const activeSession = data.sessions.find((session) => session.status === 'ACTIVE');

  if (activeSession) {
    const reservation = data.reservations.find((r) => r.id === activeSession.reservationId);
    const branch = reservation ? data.branchesById[reservation.branchId] : undefined;
    const payment = data.payments.find((p) => p.sessionId === activeSession.id);

    return (
      <div>
        <PageHeader eyebrow="Mi reserva" title="Sesión en curso" />
        {payment?.status === 'APPROVED' ? (
          <ReadyToExitCard session={activeSession} payment={payment} branch={branch} onChange={refresh} />
        ) : (
          reservation && <ActiveSessionCard session={activeSession} reservation={reservation} branch={branch} onChange={refresh} />
        )}
      </div>
    );
  }

  const pendingReservation = data.reservations.find((r) => r.status === 'PENDING' || r.status === 'CONFIRMED');

  if (pendingReservation) {
    return (
      <div>
        <PageHeader eyebrow="Mi reserva" title="Reserva activa" />
        <AwaitingEntryCard
          reservation={pendingReservation}
          branch={data.branchesById[pendingReservation.branchId]}
          onChange={refresh}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Mi reserva" title="Reserva activa" />
      <EmptyState
        title="No tienes una reserva activa"
        description="Elige una sucursal para reservar una cochera. El sistema asigna automáticamente la cochera disponible."
        action={
          <Link to="/sucursales">
            <Button size="sm">Ver sucursales</Button>
          </Link>
        }
      />
    </div>
  );
}
