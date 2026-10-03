import { PaymentStatus } from '../enums/payment-status.enum';

export interface PaymentProps {
  id: string;
  sessionId: string;
  userId: string;
  // Copia de la sucursal de la sesion al momento del cobro: payments-service
  // no tiene acceso a la base de backend, y el reporte de ingresos agrupa por
  // sucursal. Es un dato historico (el pago no se "muda" de sucursal).
  branchId: string;
  amount: number;
  status: PaymentStatus;
  externalReference: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export class Payment {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly branchId: string;
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly externalReference: string | null;
  readonly paidAt: Date | null;
  readonly createdAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.branchId = props.branchId;
    this.amount = props.amount;
    this.status = props.status;
    this.externalReference = props.externalReference;
    this.paidAt = props.paidAt;
    this.createdAt = props.createdAt;
  }

  isApproved(): boolean {
    return this.status === PaymentStatus.APPROVED;
  }
}
