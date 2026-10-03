import { DomainError } from './domain-error';

/** backend (dueño de las sesiones y de la tarifa) no respondio la cotizacion. */
export class ParkingServiceUnavailableError extends DomainError {
  readonly code = 'PARKING_SERVICE_UNAVAILABLE';

  constructor() {
    super('No se pudo obtener el monto de la sesion. Intenta nuevamente en unos segundos.');
  }
}
