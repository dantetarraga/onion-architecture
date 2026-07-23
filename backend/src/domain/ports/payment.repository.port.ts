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
  /**
   * Suma `additionalAmount` al pago existente (regularizacion de sobre-estadia, ver E3):
   * incrementa el monto, marca APPROVED y concatena la nueva referencia externa a la
   * anterior para trazabilidad, sin perder el pago original (la sesion mantiene un solo
   * registro de pago por la restriccion @unique en sessionId).
   */
  increaseAmount(id: string, additionalAmount: number, externalReference: string, paidAt: Date): Promise<Payment>;
  listByUser(userId: string): Promise<Payment[]>;
  sumApprovedAmountByBranch(branchId: string, from?: Date, to?: Date): Promise<number>;
}
