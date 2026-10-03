import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { PaymentRepositoryPort } from '../../../ports/out/payment.repository.port';
import { PAYMENT_REPOSITORY } from '../../../ports/out/tokens';
import type { GetPaymentPort } from '../../../ports/in/payments/get-payment.port';

@Injectable()
export class GetPaymentUseCase implements GetPaymentPort {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
  ) {}

  async execute(paymentId: string): Promise<Payment> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }
    return payment;
  }
}
