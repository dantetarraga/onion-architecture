import type { Reservation } from '../../../domain/entities/reservation.entity';

export interface ListUserReservationsPort {
  execute(userId: string): Promise<Reservation[]>;
}
