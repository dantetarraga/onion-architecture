import { DomainError } from './domain-error';

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor(message = 'Credenciales invalidas.') {
    super(message);
  }
}
