import type { Reservation } from '../../../domain/entities/reservation.entity';
import type { ListReservationsFilters } from '../../../application/use-cases/reservations/list-reservations.use-case';

export interface ListReservationsPort {
  execute(filters: ListReservationsFilters): Promise<Reservation[]>;
}
