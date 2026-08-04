import type { Payment } from '../../../domain/entities/payment.entity';
import type { RegisterPaymentInput } from '../../../application/use-cases/payments/register-payment.use-case';

export interface RegisterPaymentPort {
  execute(input: RegisterPaymentInput): Promise<Payment>;
}
