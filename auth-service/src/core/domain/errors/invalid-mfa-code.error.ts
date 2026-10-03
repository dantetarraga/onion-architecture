import { DomainError } from './domain-error';

export class InvalidMfaCodeError extends DomainError {
  readonly code = 'INVALID_MFA_CODE';

  constructor(message = 'Codigo de verificacion invalido o ya utilizado.') {
    super(message);
  }
}
