/**
 * Espejo del contrato publicado por el backend en
 * `backend/src/core/ports/out/notification-publisher.port.ts`
 * (interfaz `ReservationConfirmationEvent`).
 *
 * Este servicio es deliberadamente independiente: no importa codigo del
 * backend ni comparte proceso/deploy con el. Lo unico que comparten es este
 * contrato de datos sobre Kafka. Si el backend cambia el evento, hay que
 * actualizar esta copia a mano (es el costo aceptado de mantener el servicio
 * realmente desacoplado).
 */
export interface ReservationConfirmationEvent {
  eventId: string;
  eventType: 'reservation.confirmation.email';
  occurredAt: string; // JSON.stringify serializa Date como ISO string
  reservationId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
  slotId: string;
  startAt: string;
  expiresAt: string;
}

export function isReservationConfirmationEvent(
  value: unknown,
): value is ReservationConfirmationEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    event.eventType === 'reservation.confirmation.email' &&
    typeof event.reservationId === 'string' &&
    typeof event.userEmail === 'string'
  );
}
