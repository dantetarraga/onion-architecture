import { Inject, Injectable } from '@nestjs/common';
import { ParkingSession } from '../../../domain/entities/parking-session.entity';
import type { ParkingSessionRepositoryPort } from '../../../ports/out/parking-session.repository.port';
import { PARKING_SESSION_REPOSITORY } from '../../../ports/out/tokens';
import type { ListUserSessionsPort } from '../../../ports/in/parking/list-user-sessions.port';

@Injectable()
export class ListUserSessionsUseCase implements ListUserSessionsPort {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY)
    private readonly sessions: ParkingSessionRepositoryPort,
  ) {}

  async execute(userId: string): Promise<ParkingSession[]> {
    return this.sessions.listByUser(userId);
  }
}
