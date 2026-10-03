import { DomainError } from './domain-error';

export class SessionNotActiveError extends DomainError {
  readonly code = 'SESSION_NOT_ACTIVE';

  constructor(message = 'No existe una sesion de estacionamiento activa.') {
    super(message);
  }
}
