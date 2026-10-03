import { HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { CircuitBreaker, CircuitOpenError } from '../common/circuit-breaker';
import { circuitBreakerMetrics } from '../observability/metrics';

/**
 * Misma tabla codigo->status que domain-exception.filter.ts en backend: el
 * gateway la reproduce porque es el unico punto que vuelve a hablar HTTP con
 * el frontend. auth-service manda el codigo de dominio (`INVALID_CREDENTIALS`,
 * etc.) como JSON en el mensaje del RpcException (ver
 * auth-service/src/adapters/in/grpc/grpc-domain-error.ts); aqui se decodifica
 * y se arma el mismo `{statusCode, code, message}` que el frontend ya conoce.
 */
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  INVALID_MFA_CODE: HttpStatus.UNAUTHORIZED,
  MFA_ALREADY_ENABLED: HttpStatus.CONFLICT,
  MFA_NOT_CONFIGURED: HttpStatus.CONFLICT,
  EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
};

/**
 * Tope por llamada a auth-service. Sin esto, si auth-service se cuelga (no
 * caido, sino lento) cada login del gateway queda esperando indefinidamente.
 */
const RPC_TIMEOUT_MS = Number(process.env.AUTH_RPC_TIMEOUT_MS) || 3000;

/**
 * Un solo breaker por proceso para todo auth-service. Solo los errores de
 * transporte (caido, timeout) cuentan como fallo; un INVALID_CREDENTIALS es
 * una respuesta valida de un servicio sano.
 */
export const authServiceBreaker = new CircuitBreaker({
  name: 'auth-service',
  isFailure: (error) => decodeDomainError(error) === null,
  ...circuitBreakerMetrics,
});

/** Llama al gRPC client y traduce cualquier error de dominio al mismo shape HTTP de siempre. */
export async function callAuthRpc<T>(source: Observable<T>): Promise<T> {
  try {
    return await authServiceBreaker.execute(() =>
      firstValueFrom(source.pipe(timeout(RPC_TIMEOUT_MS))),
    );
  } catch (error) {
    throw toHttpException(error);
  }
}

function decodeDomainError(
  error: unknown,
): { code: string; message?: string } | null {
  const details = (error as { details?: string } | undefined)?.details;
  if (!details) {
    return null;
  }
  try {
    const parsed = JSON.parse(details) as { code?: string; message?: string };
    return parsed.code ? { code: parsed.code, message: parsed.message } : null;
  } catch {
    // `details` no era JSON (p. ej. auth-service caido): no es de dominio.
    return null;
  }
}

function toHttpException(error: unknown): HttpException {
  const domain = decodeDomainError(error);
  if (domain) {
    const status = STATUS_BY_CODE[domain.code] ?? HttpStatus.BAD_REQUEST;
    return new HttpException(
      {
        statusCode: status,
        code: domain.code,
        message: domain.message ?? 'Error inesperado al comunicarse con auth-service.',
      },
      status,
    );
  }

  // Fallo de infraestructura (caido, timeout o circuito abierto): 503, no
  // 400; el cliente puede reintentar, no es culpa de su request.
  const status = HttpStatus.SERVICE_UNAVAILABLE;
  return new HttpException(
    {
      statusCode: status,
      code: 'AUTH_SERVICE_UNAVAILABLE',
      message:
        error instanceof CircuitOpenError
          ? 'El servicio de autenticacion no esta disponible. Intenta nuevamente en unos segundos.'
          : 'No se pudo comunicar con el servicio de autenticacion. Intenta nuevamente.',
    },
    status,
  );
}
