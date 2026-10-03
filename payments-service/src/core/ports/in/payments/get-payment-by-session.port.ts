import type { Payment } from '../../../domain/entities/payment.entity';

export interface GetPaymentBySessionPort {
  execute(sessionId: string): Promise<Payment | null>;
}
