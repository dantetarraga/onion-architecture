import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../../domain/errors/domain-error';

const STATUS_BY_CODE: Record<string, number> = {
  SLOT_NOT_AVAILABLE: HttpStatus.CONFLICT,
  RESERVATION_ALREADY_ACTIVE: HttpStatus.CONFLICT,
  SESSION_NOT_ACTIVE: HttpStatus.CONFLICT,
  PAYMENT_NOT_APPROVED: HttpStatus.FORBIDDEN,
  RESERVATION_EXPIRED: HttpStatus.GONE,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
  NO_AVAILABILITY: HttpStatus.CONFLICT,
  INVALID_QR_CODE: HttpStatus.BAD_REQUEST,
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
