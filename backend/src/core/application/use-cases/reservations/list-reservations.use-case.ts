import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../ports/out/tokens';
import type { ListReservationsPort } from '../../../ports/in/reservations/list-reservations.port';

export interface ListReservationsFilters {
  branchId?: string;
  status?: ReservationStatus;
}

/** Uso administrativo: lista reservas de todas las sucursales con filtros. */
@Injectable()
export class ListReservationsUseCase implements ListReservationsPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
  ) {}

  async execute(filters: ListReservationsFilters): Promise<Reservation[]> {
    return this.reservations.listByFilters(filters);
  }
}
