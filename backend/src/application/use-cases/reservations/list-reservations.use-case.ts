import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';

export interface ListReservationsFilters {
  branchId?: string;
  status?: ReservationStatus;
}

/** Uso administrativo: lista reservas de todas las sucursales con filtros. */
@Injectable()
export class ListReservationsUseCase {
  constructor(@Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort) {}

  async execute(filters: ListReservationsFilters): Promise<Reservation[]> {
    return this.reservations.listByFilters(filters);
  }
}
