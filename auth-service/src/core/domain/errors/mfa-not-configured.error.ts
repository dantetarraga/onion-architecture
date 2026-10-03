import { DomainError } from './domain-error';

export class MfaNotConfiguredError extends DomainError {
  readonly code = 'MFA_NOT_CONFIGURED';

  constructor(message = 'La verificacion en dos pasos no esta configurada.') {
    super(message);
  }
}
