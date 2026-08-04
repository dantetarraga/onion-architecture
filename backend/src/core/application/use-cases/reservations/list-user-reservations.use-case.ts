import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../../../domain/entities/reservation.entity';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../ports/out/tokens';
import type { ListUserReservationsPort } from '../../../ports/in/reservations/list-user-reservations.port';

@Injectable()
export class ListUserReservationsUseCase implements ListUserReservationsPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
  ) {}

  async execute(userId: string): Promise<Reservation[]> {
    return this.reservations.listByUser(userId);
  }
}
