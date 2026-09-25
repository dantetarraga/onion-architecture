import { DomainError } from './domain-error';

/** payments-service no respondio: no se puede confirmar si la sesion esta pagada. */
export class PaymentServiceUnavailableError extends DomainError {
  readonly code = 'PAYMENT_SERVICE_UNAVAILABLE';

  constructor() {
    super('No se pudo consultar el estado del pago. Intenta nuevamente en unos segundos.');
  }
}
