import { DomainError } from './domain-error';

export class MfaAlreadyEnabledError extends DomainError {
  readonly code = 'MFA_ALREADY_ENABLED';

  constructor(message = 'La verificacion en dos pasos ya esta activada.') {
    super(message);
  }
}
