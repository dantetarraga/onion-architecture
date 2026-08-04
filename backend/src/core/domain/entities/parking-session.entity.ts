import { SessionStatus } from '../enums/session-status.enum';

export interface ParkingSessionProps {
  id: string;
  reservationId: string;
  userId: string;
  slotId: string;
  status: SessionStatus;
  entryAt: Date;
  exitAt: Date | null;
}

export class ParkingSession {
  readonly id: string;
  readonly reservationId: string;
  readonly userId: string;
  readonly slotId: string;
  readonly status: SessionStatus;
  readonly entryAt: Date;
  readonly exitAt: Date | null;

  constructor(props: ParkingSessionProps) {
    this.id = props.id;
    this.reservationId = props.reservationId;
    this.userId = props.userId;
    this.slotId = props.slotId;
    this.status = props.status;
    this.entryAt = props.entryAt;
    this.exitAt = props.exitAt;
  }

  isActive(): boolean {
    return this.status === SessionStatus.ACTIVE;
  }
}
