import { DomainError } from './domain-error';

/**
 * Error de dominio que viene de OTRO servicio por gRPC (ver
 * adapters/out/parking/parking-grpc.adapter.ts): conserva el `code` original
 * para que DomainExceptionFilter responda el mismo status HTTP que respondia
 * el monolito (p.ej. NOT_FOUND -> 404).
 */
export class RemoteDomainError extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
