import { RpcException } from '@nestjs/microservices';
import { DomainError } from '../../../core/domain/errors/domain-error';

/**
 * Mismo criterio que auth-service: un DomainError viaja como RpcException
 * cuyo mensaje es el JSON `{code, message}`; el cliente (backend) lo lee de
 * `error.details` y conserva el codigo de dominio.
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
