import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../../../domain/entities/reservation.entity';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class ListUserReservationsUseCase {
  constructor(@Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort) {}

  async execute(userId: string): Promise<Reservation[]> {
    return this.reservations.listByUser(userId);
  }
}
