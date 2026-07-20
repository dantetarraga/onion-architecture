import { DomainError } from './domain-error';

export class NoAvailabilityError extends DomainError {
  readonly code = 'NO_AVAILABILITY';

  constructor(message = 'No hay disponibilidad en la sucursal solicitada ni en sucursales cercanas.') {
    super(message);
  }
}
