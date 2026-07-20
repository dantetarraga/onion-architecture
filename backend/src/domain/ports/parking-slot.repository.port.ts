import { ParkingSlot } from '../entities/parking-slot.entity';
import { SlotStatus } from '../enums/slot-status.enum';
import { SlotType } from '../enums/slot-type.enum';

export interface SlotAvailabilityCount {
  type: SlotType;
  total: number;
  available: number;
}

export interface BranchOccupancySummary {
  branchId: string;
  totalSlots: number;
  occupiedOrReserved: number;
}

export interface ParkingSlotRepositoryPort {
  findById(id: string): Promise<ParkingSlot | null>;
  countByBranchAndType(branchId: string): Promise<SlotAvailabilityCount[]>;
  hasAvailability(branchId: string, type?: SlotType): Promise<boolean>;
  /** Reclama atomicamente la primera cochera DISPONIBLE del tipo pedido (o cualquier tipo) y la pasa a RESERVADA. */
  claimAvailableSlot(branchId: string, type?: SlotType): Promise<ParkingSlot | null>;
  updateStatus(slotId: string, status: SlotStatus): Promise<void>;
  getOccupancySummary(branchIds: string[]): Promise<BranchOccupancySummary[]>;
  /** Fuerza todas las cocheras de una sucursal a OCUPADA, usado por el endpoint admin de demo. */
  markAllOccupied(branchId: string): Promise<void>;
}
