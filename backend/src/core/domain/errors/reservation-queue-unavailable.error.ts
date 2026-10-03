import { DomainError } from './domain-error';

export class ReservationQueueUnavailableError extends DomainError {
  readonly code = 'RESERVATION_QUEUE_UNAVAILABLE';

  constructor(
    message = 'La cola de solicitudes de reserva no esta disponible. Intenta nuevamente en unos segundos.',
  ) {
    super(message);
  }
}
