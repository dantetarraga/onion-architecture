import { DomainError } from './domain-error';

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor(message = 'El correo ya se encuentra registrado.') {
    super(message);
  }
}
