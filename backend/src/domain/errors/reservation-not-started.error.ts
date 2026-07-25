import { DomainError } from './domain-error';

export class ReservationNotStartedError extends DomainError {
  readonly code = 'RESERVATION_NOT_STARTED';

  constructor(message = 'La reserva todavía no ha comenzado.') {
    super(message);
  }
}
