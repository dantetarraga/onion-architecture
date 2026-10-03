import { DomainError } from './domain-error';

export class SessionAlreadyActiveError extends DomainError {
  readonly code = 'SESSION_ALREADY_ACTIVE';

  constructor(message = 'La reserva ya tiene una sesion de estacionamiento activa.') {
    super(message);
  }
}
