import { DomainError } from './domain-error';

export class OverstayPaymentInsufficientError extends DomainError {
  readonly code = 'OVERSTAY_PAYMENT_INSUFFICIENT';
  readonly missingAmount: number;

  constructor(missingAmount: number) {
    super(`El pago registrado no cubre la estadia real. Falta pagar S/ ${missingAmount.toFixed(2)}.`);
    this.missingAmount = missingAmount;
  }
}
