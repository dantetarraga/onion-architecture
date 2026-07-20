import { DomainError } from './domain-error';

export class PaymentNotApprovedError extends DomainError {
  readonly code = 'PAYMENT_NOT_APPROVED';

  constructor(message = 'La salida requiere un pago aprobado.') {
    super(message);
  }
}
