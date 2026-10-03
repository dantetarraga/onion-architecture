/**
 * Evento que el nucleo publica cuando una reserva queda confirmada. Es el
 * contrato entre este backend y el servicio externo de notificaciones: el
 * nucleo no sabe que existe Kafka ni que el consumidor manda un correo,
 * solo que "algo de afuera" quiere enterarse de esta confirmacion.
 */
export interface ReservationConfirmationEvent {
  eventId: string;
  eventType: 'reservation.confirmation.email';
  occurredAt: Date;
  reservationId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
  slotId: string;
  startAt: Date;
  expiresAt: Date;
}

/**
 * Puerto OUT: el nucleo necesita avisarle a un sistema externo (cola de
 * mensajes -> servicio de notificaciones -> correo) que ocurrio algo digno
 * de notificar. Misma logica de clasificacion que `RealtimeNotifierPort`
 * (ver docs/arquitectura-hexagonal.md, seccion 4.3): quien llama a quien
 * define la direccion, y aqui es el nucleo quien llama hacia afuera.
 */
export interface NotificationPublisherPort {
  publishReservationConfirmation(
    event: ReservationConfirmationEvent,
  ): Promise<void>;
}
