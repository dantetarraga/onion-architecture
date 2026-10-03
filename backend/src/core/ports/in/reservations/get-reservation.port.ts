import type { Reservation } from '../../../domain/entities/reservation.entity';

export interface GetReservationPort {
  execute(reservationId: string): Promise<Reservation>;
}
