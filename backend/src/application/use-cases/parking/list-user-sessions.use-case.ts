import { Inject, Injectable } from '@nestjs/common';
import { ParkingSession } from '../../../domain/entities/parking-session.entity';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import { PARKING_SESSION_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class ListUserSessionsUseCase {
  constructor(@Inject(PARKING_SESSION_REPOSITORY) private readonly sessions: ParkingSessionRepositoryPort) {}

  async execute(userId: string): Promise<ParkingSession[]> {
    return this.sessions.listByUser(userId);
  }
}
