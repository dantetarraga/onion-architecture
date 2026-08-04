import { DomainError } from './domain-error';

export class ReservationAlreadyActiveError extends DomainError {
  readonly code = 'RESERVATION_ALREADY_ACTIVE';

  constructor(message = 'El usuario ya tiene una reserva o sesion activa.') {
    super(message);
  }
}
