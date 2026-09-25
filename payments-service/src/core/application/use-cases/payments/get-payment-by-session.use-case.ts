import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import type { PaymentRepositoryPort } from '../../../ports/out/payment.repository.port';
import { PAYMENT_REPOSITORY } from '../../../ports/out/tokens';
import type { GetPaymentBySessionPort } from '../../../ports/in/payments/get-payment-by-session.port';

/** Lo consume backend (via gRPC) al registrar la salida: sin pago aprobado no se libera la cochera. */
@Injectable()
export class GetPaymentBySessionUseCase implements GetPaymentBySessionPort {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
  ) {}

  execute(sessionId: string): Promise<Payment | null> {
    return this.payments.findBySessionId(sessionId);
  }
}
