import type { Payment } from '../../../domain/entities/payment.entity';

export interface ListUserPaymentsPort {
  execute(userId: string): Promise<Payment[]>;
}
