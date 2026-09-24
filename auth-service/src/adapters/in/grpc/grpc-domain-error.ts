import { RpcException } from '@nestjs/microservices';
import { DomainError } from '../../../core/domain/errors/domain-error';

/**
 * Traduce un DomainError a un RpcException cuyo mensaje es el mismo JSON
 * `{code, message}` que hoy arma DomainExceptionFilter para HTTP. El cliente
 * gRPC (gateway/backend) recibe ese JSON en `error.details` y lo vuelve a
 * mapear a `{statusCode, code, message}` con la misma tabla STATUS_BY_CODE
 * de siempre — el codigo de dominio nunca cambia de forma en el viaje.
 */
export async function callUseCase<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof DomainError) {
      throw new RpcException(
        JSON.stringify({ code: error.code, message: error.message }),
      );
    }
    throw error;
  }
}
