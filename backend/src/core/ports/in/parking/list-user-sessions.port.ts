import type { ParkingSession } from '../../../domain/entities/parking-session.entity';

export interface ListUserSessionsPort {
  execute(userId: string): Promise<ParkingSession[]>;
}
