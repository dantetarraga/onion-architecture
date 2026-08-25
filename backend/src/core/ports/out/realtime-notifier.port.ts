import { SlotStatus } from '../../domain/enums/slot-status.enum';

/**
 * Resultado de una solicitud de reserva encolada, tal como se lo devuelve
 * al navegador que la origino. Cierra el ciclo asincrono que abrio
 * `POST /reservations` al responder 202 con el `requestId`.
 */
export interface ReservationRequestResolvedPayload {
  requestId: string;
  userId: string;
  status: 'CREATED' | 'SUGGEST_OTHER_BRANCH' | 'REJECTED';
  reservation?: {
    id: string;
    branchId: string;
    slotId: string;
    startAt: Date;
    expiresAt: Date;
  };
  suggestedBranch?: { id: string; name: string; address: string };
  distanceKm?: number;
  code?: string;
  message?: string;
}

export interface RealtimeNotifierPort {
  notifyReservationCreated(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
    userId: string;
    expiresAt: Date;
  }): void;
  notifyReservationExpired(payload: { reservationId: string; branchId: string; slotId: string }): void;
  notifyReservationCancelled(payload: { reservationId: string; branchId: string; slotId: string }): void;
  notifySlotStatusChanged(payload: { branchId: string; slotId: string; status: SlotStatus }): void;
  notifyOccupancyUpdated(branchId: string): void;
  notifyEntryRegistered(payload: { sessionId: string; branchId: string; slotId: string; userId: string }): void;
  notifyExitRegistered(payload: { sessionId: string; branchId: string; slotId: string }): void;
  notifyPaymentRegistered(payload: {
    paymentId: string;
    sessionId: string;
    amount: number;
    status: string;
  }): void;
  notifyReservationRequestResolved(payload: ReservationRequestResolvedPayload): void;
}
