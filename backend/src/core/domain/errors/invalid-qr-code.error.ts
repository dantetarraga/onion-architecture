import { DomainError } from './domain-error';

export class InvalidQrCodeError extends DomainError {
  readonly code = 'INVALID_QR_CODE';

  constructor(message = 'El codigo QR es invalido o ha expirado.') {
    super(message);
  }
}
