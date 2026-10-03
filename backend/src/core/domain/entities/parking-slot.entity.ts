import { SlotStatus } from '../enums/slot-status.enum';
import { SlotType } from '../enums/slot-type.enum';

export interface ParkingSlotProps {
  id: string;
  branchId: string;
  code: string;
  type: SlotType;
  status: SlotStatus;
  updatedAt: Date;
}

export class ParkingSlot {
  readonly id: string;
  readonly branchId: string;
  readonly code: string;
  readonly type: SlotType;
  readonly status: SlotStatus;
  readonly updatedAt: Date;

  constructor(props: ParkingSlotProps) {
    this.id = props.id;
    this.branchId = props.branchId;
    this.code = props.code;
    this.type = props.type;
    this.status = props.status;
    this.updatedAt = props.updatedAt;
  }

  isAvailable(): boolean {
    return this.status === SlotStatus.DISPONIBLE;
  }
}
