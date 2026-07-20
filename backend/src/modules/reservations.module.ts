import { Module } from '@nestjs/common';
import { CancelReservationUseCase } from '../application/use-cases/reservations/cancel-reservation.use-case';
import { CreateReservationUseCase } from '../application/use-cases/reservations/create-reservation.use-case';
import { ExpireOverdueReservationsUseCase } from '../application/use-cases/reservations/expire-overdue-reservations.use-case';
import { GetReservationUseCase } from '../application/use-cases/reservations/get-reservation.use-case';
import { ListReservationsUseCase } from '../application/use-cases/reservations/list-reservations.use-case';
import { ReservationsController } from '../presentation/http/controllers/reservations.controller';

@Module({
  controllers: [ReservationsController],
  providers: [
    CreateReservationUseCase,
    CancelReservationUseCase,
    GetReservationUseCase,
    ListReservationsUseCase,
    ExpireOverdueReservationsUseCase,
  ],
  exports: [ExpireOverdueReservationsUseCase],
})
export class ReservationsModule {}
