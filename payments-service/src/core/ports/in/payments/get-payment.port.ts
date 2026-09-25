import type { Payment } from '../../../domain/entities/payment.entity';

export interface GetPaymentPort {
  execute(paymentId: string): Promise<Payment>;
}
