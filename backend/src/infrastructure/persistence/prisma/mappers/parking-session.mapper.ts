import { ParkingSession as PrismaParkingSession } from '@prisma/client';
import { ParkingSession } from '../../../../domain/entities/parking-session.entity';
import { SessionStatus } from '../../../../domain/enums/session-status.enum';

export class ParkingSessionMapper {
  static toDomain(record: PrismaParkingSession): ParkingSession {
    return new ParkingSession({
      id: record.id,
      reservationId: record.reservationId,
      userId: record.userId,
      slotId: record.slotId,
      status: record.status as unknown as SessionStatus,
      entryAt: record.entryAt,
      exitAt: record.exitAt,
    });
  }
}
