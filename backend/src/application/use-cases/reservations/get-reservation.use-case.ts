import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class GetReservationUseCase {
  constructor(@Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort) {}

  async execute(reservationId: string): Promise<Reservation> {
    const reservation = await this.reservations.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }
    return reservation;
  }
}
