import { HttpException, HttpStatus } from '@nestjs/common';
import { firstValueFrom, Observable } from 'rxjs';

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

/** Llama al gRPC client y traduce cualquier error de dominio al mismo shape HTTP de siempre. */
export async function callAuthRpc<T>(source: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(source);
  } catch (error) {
    throw toHttpException(error);
  }
}

function toHttpException(error: unknown): HttpException {
  const details = (error as { details?: string } | undefined)?.details;
  let code = 'UNKNOWN';
  let message = 'Error inesperado al comunicarse con auth-service.';

  if (details) {
    try {
      const parsed = JSON.parse(details) as { code?: string; message?: string };
      if (parsed.code) {
        code = parsed.code;
        message = parsed.message ?? message;
      }
    } catch {
      // `details` no era JSON (p. ej. auth-service caido): se mantiene el generico.
    }
  }

  const status = STATUS_BY_CODE[code] ?? HttpStatus.BAD_REQUEST;
  return new HttpException({ statusCode: status, code, message }, status);
}
