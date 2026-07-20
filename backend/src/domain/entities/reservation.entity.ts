import { ReservationStatus } from '../enums/reservation-status.enum';
import { SlotType } from '../enums/slot-type.enum';

export interface ReservationProps {
  id: string;
  userId: string;
  branchId: string;
  slotId: string;
  requestedType: SlotType;
  status: ReservationStatus;
  createdAt: Date;
  expiresAt: Date;
  confirmedAt: Date | null;
}

export class Reservation {
  readonly id: string;
  readonly userId: string;
  readonly branchId: string;
  readonly slotId: string;
  readonly requestedType: SlotType;
  readonly status: ReservationStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly confirmedAt: Date | null;

  constructor(props: ReservationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.branchId = props.branchId;
    this.slotId = props.slotId;
    this.requestedType = props.requestedType;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this.confirmedAt = props.confirmedAt;
  }

  isPending(): boolean {
    return this.status === ReservationStatus.PENDING;
  }
}
