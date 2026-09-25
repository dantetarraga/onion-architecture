import { Payment } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';

export interface CreatePaymentData {
  sessionId: string;
  userId: string;
  branchId: string;
  amount: number;
  status: PaymentStatus;
  externalReference: string | null;
  paidAt: Date | null;
}

export interface BranchRevenue {
  branchId: string;
  total: number;
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
  increaseAmount(
    id: string,
    additionalAmount: number,
    externalReference: string,
    paidAt: Date,
  ): Promise<Payment>;
  listByUser(userId: string): Promise<Payment[]>;
  /** Una fila por cada `branchIds` pedido (0 si no tiene pagos aprobados en el rango). */
  sumApprovedByBranch(
    branchIds: string[],
    from?: Date,
    to?: Date,
  ): Promise<BranchRevenue[]>;
}
