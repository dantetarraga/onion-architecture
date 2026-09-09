import { Branch } from '../entities/branch.entity';
import { ParkingSlot } from '../entities/parking-slot.entity';
import { SlotType } from '../enums/slot-type.enum';

export interface SlotAssignmentInput {
  branchId: string;
  slotType?: SlotType;
}

export type SlotAssignmentResult =
  | { outcome: 'ASSIGNED'; slot: ParkingSlot }
  | { outcome: 'SUGGEST_OTHER_BRANCH'; suggestedBranch: Branch; distanceKm: number }
  | { outcome: 'NO_AVAILABILITY' };

/**
 * Decide que cochera asignar dentro de una sucursal, o si corresponde sugerir
 * la sucursal cercana con cupo. Implementacion intercambiable (Politica 1).
 */
export interface SlotAssignmentPolicy {
  assign(input: SlotAssignmentInput): Promise<SlotAssignmentResult>;
}
