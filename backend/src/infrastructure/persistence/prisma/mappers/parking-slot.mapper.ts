import { ParkingSlot as PrismaParkingSlot } from '@prisma/client';
import { ParkingSlot } from '../../../../domain/entities/parking-slot.entity';
import { SlotStatus } from '../../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../../domain/enums/slot-type.enum';

export class ParkingSlotMapper {
  static toDomain(record: PrismaParkingSlot): ParkingSlot {
    return new ParkingSlot({
      id: record.id,
      branchId: record.branchId,
      code: record.code,
      type: record.type as unknown as SlotType,
      status: record.status as unknown as SlotStatus,
      updatedAt: record.updatedAt,
    });
  }
}
