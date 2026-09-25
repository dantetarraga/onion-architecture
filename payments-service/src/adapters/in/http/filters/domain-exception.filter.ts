import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../../../core/domain/errors/domain-error';

// Mismos status que el DomainExceptionFilter de backend para los codigos que
// este servicio puede producir (propios o recibidos de backend por gRPC).
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  SESSION_NOT_ACTIVE: HttpStatus.CONFLICT,
  PAYMENT_NOT_APPROVED: HttpStatus.FORBIDDEN,
  PARKING_SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
