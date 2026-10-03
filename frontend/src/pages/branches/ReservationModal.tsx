import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { branchesApi } from '@/api/branches.api';
import { reservationsApi } from '@/api/reservations.api';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { notifyError, notifySuccess } from '@/lib/notify';
import { SLOT_TYPE_LABEL } from '@/types/enums';
import type { SlotType } from '@/types/enums';
import type {
  Branch,
  ReservationRequestResolved,
  SlotAvailabilityCount,
} from '@/types/entities';

interface ReservationModalProps {
  branch: Branch | null;
  onClose: () => void;
}

interface SuggestedBranch {
  id: string;
  name: string;
  address: string;
}

/** Margen antes de dejar de esperar el evento del worker. */
const RESOLUTION_TIMEOUT_MS = 20_000;

export function ReservationModal({ branch, onClose }: ReservationModalProps) {
  const [availability, setAvailability] = useState<SlotAvailabilityCount[] | null>(null);
  const [slotType, setSlotType] = useState<SlotType | ''>('');
  const [reservationMode, setReservationMode] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ suggestedBranch: SuggestedBranch; distanceKm: number } | null>(
    null,
  );
  // Solicitud encolada cuya resolucion todavia se espera por WebSocket.
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const stopWaiting = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingRequestId(null);
    setSubmitting(false);
  }, []);

  useEffect(() => stopWaiting, [stopWaiting]);

  useEffect(() => {
    if (!branch) return;
    setAvailability(null);
    setSlotType('');
    setStartDate('');
    setStartTime('');
    setSuggestion(null);
    stopWaiting();
    branchesApi
      .availability(branch.id)
      .then((result) => setAvailability(result.availability))
      .catch((error) => notifyError(error));
  }, [branch, stopWaiting]);

  // El worker resuelve la solicitud fuera del request HTTP; el desenlace
  // vuelve por este evento, filtrado por el requestId que devolvio el 202.
  useSocketEvent<ReservationRequestResolved>('reservation.request.resolved', (payload) => {
    if (!pendingRequestId || payload.requestId !== pendingRequestId) return;

    stopWaiting();

    if (payload.status === 'CREATED') {
      notifySuccess('Reserva creada. Tienes 20 minutos para hacer check-in.');
      onClose();
      navigate('/mi-reserva');
      return;
    }

    if (payload.status === 'SUGGEST_OTHER_BRANCH' && payload.suggestedBranch) {
      setSuggestion({
        suggestedBranch: payload.suggestedBranch,
        distanceKm: payload.distanceKm ?? 0,
      });
      return;
    }

    notifyError(new Error(payload.message ?? 'No se pudo crear la reserva.'));
  });

  if (!branch) return null;

  async function handleConfirm(targetBranchId: string, isSuggestion: boolean) {
    if (reservationMode === 'SCHEDULED' && (!startDate || !startTime)) {
      notifyError(new Error('Selecciona tanto la fecha como la hora de inicio.'));
      return;
    }

    setSubmitting(true);
    try {
      const startAt =
        reservationMode === 'SCHEDULED' && startDate && startTime
          ? new Date(`${startDate}T${startTime}`).toISOString()
          : undefined;
      const accepted = isSuggestion
        ? await reservationsApi.confirmSuggestion(targetBranchId, slotType || undefined, startAt)
        : await reservationsApi.create(targetBranchId, slotType || undefined, startAt);

      // 202: la solicitud esta en la cola. Se sigue esperando hasta que el
      // worker la procese y llegue `reservation.request.resolved`.
      setPendingRequestId(accepted.requestId);
      timeoutRef.current = window.setTimeout(() => {
        stopWaiting();
        notifyError(
          new Error('Tu solicitud sigue en cola. Revisa "Mi reserva" en unos segundos.'),
        );
      }, RESOLUTION_TIMEOUT_MS);
    } catch (error) {
      setSubmitting(false);
      notifyError(error);
    }
  }

  return (
    <Modal open onClose={onClose} title={suggestion ? 'Sucursal sugerida' : `Reservar en ${branch.name}`}>
      {suggestion ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-asphalt">
            <strong>{branch.name}</strong> no tiene cupo disponible ahora mismo. La sucursal más cercana con
            disponibilidad es:
          </p>
          <div className="rounded-sm border border-steel-100 bg-concrete px-4 py-3">
            <p className="font-display text-lg text-asphalt">{suggestion.suggestedBranch.name}</p>
            <p className="text-sm text-steel">{suggestion.suggestedBranch.address}</p>
            <p className="mt-1 font-mono text-xs text-signal-yellow-600">
              {suggestion.distanceKm.toFixed(1)} km de distancia
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              loading={submitting}
              onClick={() => handleConfirm(suggestion.suggestedBranch.id, true)}
              className="flex-1"
            >
              Reservar aquí
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!availability ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <Select
              label="Tipo de cochera"
              value={slotType}
              onChange={(event) => setSlotType(event.target.value as SlotType | '')}
            >
              <option value="">Cualquiera disponible</option>
              {availability.map((slot) => (
                <option key={slot.type} value={slot.type} disabled={slot.available === 0}>
                  {SLOT_TYPE_LABEL[slot.type]} — {slot.available}/{slot.total} libres
                </option>
              ))}
            </Select>
          )}

              <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              className={`rounded border px-4 py-3 text-left ${
                reservationMode === 'IMMEDIATE'
                  ? 'border-signal-yellow-600 bg-signal-yellow-50 text-asphalt'
                  : 'border-steel-200 bg-white text-steel'
              }`}
              onClick={() => setReservationMode('IMMEDIATE')}
            >
              <p className="font-medium">Reservar ahora</p>
              <p className="text-xs text-steel">Genera la reserva para este momento</p>
            </button>
            <button
              type="button"
              className={`rounded border px-4 py-3 text-left ${
                reservationMode === 'SCHEDULED'
                  ? 'border-signal-yellow-600 bg-signal-yellow-50 text-asphalt'
                  : 'border-steel-200 bg-white text-steel'
              }`}
              onClick={() => setReservationMode('SCHEDULED')}
            >
              <p className="font-medium">Reservar para después</p>
              <p className="text-xs text-steel">Elige fecha y hora de inicio</p>
            </button>
          </div>

          {reservationMode === 'SCHEDULED' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Fecha de inicio"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <Input
                label="Hora de inicio"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
          )}

          <p className="-mt-1 text-xs text-steel">
            {reservationMode === 'IMMEDIATE'
              ? 'La reserva se crea de inmediato con la hora actual.'
              : 'Selecciona fecha y hora para programar la reserva.'}
          </p>

          {pendingRequestId && (
            <p className="-mt-2 flex items-center gap-2 font-mono text-xs text-signal-yellow-600">
              <Spinner />
              Solicitud en cola, procesando…
            </p>
          )}

          <Button loading={submitting} disabled={!availability} onClick={() => handleConfirm(branch.id, false)}>
            {pendingRequestId ? 'Procesando…' : 'Confirmar reserva'}
          </Button>
        </div>
      )}
    </Modal>
  );
}
