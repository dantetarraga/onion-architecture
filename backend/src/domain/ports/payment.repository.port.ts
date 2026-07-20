import { Payment } from '../entities/payment.entity';

export interface CreatePaymentData {
  sessionId: string;
  userId: string;
  amount: number;
  status: import('../enums/payment-status.enum').PaymentStatus;
  externalReference: string | null;
  paidAt: Date | null;
}

export interface PaymentRepositoryPort {
  findById(id: string): Promise<Payment | null>;
  findBySessionId(sessionId: string): Promise<Payment | null>;
  create(data: CreatePaymentData): Promise<Payment>;
  listByUser(userId: string): Promise<Payment[]>;
  sumApprovedAmountByBranch(branchId: string, from?: Date, to?: Date): Promise<number>;
}
