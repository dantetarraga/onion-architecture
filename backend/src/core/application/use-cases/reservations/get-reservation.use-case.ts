import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../ports/out/tokens';
import type { GetReservationPort } from '../../../ports/in/reservations/get-reservation.port';

@Injectable()
export class GetReservationUseCase implements GetReservationPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
  ) {}

  async execute(reservationId: string): Promise<Reservation> {
    const reservation = await this.reservations.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }
    return reservation;
  }
}
