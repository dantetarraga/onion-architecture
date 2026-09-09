import { DomainError } from './domain-error';

export class SlotNotAvailableError extends DomainError {
  readonly code = 'SLOT_NOT_AVAILABLE';

  constructor(message = 'No hay cocheras disponibles del tipo solicitado en esta sucursal.') {
    super(message);
  }
}
