import { Reservation as PrismaReservation } from '@prisma/client';
import { Reservation } from '../../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../../domain/enums/reservation-status.enum';
import { SlotType } from '../../../../domain/enums/slot-type.enum';

export class ReservationMapper {
  static toDomain(record: PrismaReservation): Reservation {
    return new Reservation({
      id: record.id,
      userId: record.userId,
      branchId: record.branchId,
      slotId: record.slotId,
      requestedType: record.requestedType as unknown as SlotType,
      status: record.status as unknown as ReservationStatus,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      confirmedAt: record.confirmedAt,
    });
  }
}
