import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import type { PaymentRepositoryPort } from '../../../ports/out/payment.repository.port';
import { PAYMENT_REPOSITORY } from '../../../ports/out/tokens';
import type { ListUserPaymentsPort } from '../../../ports/in/payments/list-user-payments.port';

@Injectable()
export class ListUserPaymentsUseCase implements ListUserPaymentsPort {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
  ) {}

  async execute(userId: string): Promise<Payment[]> {
    return this.payments.listByUser(userId);
  }
}
