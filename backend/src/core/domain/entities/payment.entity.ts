import { PaymentStatus } from '../enums/payment-status.enum';

export interface PaymentProps {
  id: string;
  sessionId: string;
  userId: string;
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
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly externalReference: string | null;
  readonly paidAt: Date | null;
  readonly createdAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
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
