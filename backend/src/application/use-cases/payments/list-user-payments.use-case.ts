import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import type { PaymentRepositoryPort } from '../../../domain/ports/payment.repository.port';
import { PAYMENT_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class ListUserPaymentsUseCase {
  constructor(@Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort) {}

  async execute(userId: string): Promise<Payment[]> {
    return this.payments.listByUser(userId);
  }
}
