import { DomainError } from './domain-error';

export class ReservationExpiredError extends DomainError {
  readonly code = 'RESERVATION_EXPIRED';

  constructor(message = 'La reserva ha expirado por la ventana de tolerancia.') {
    super(message);
  }
}
