import { Module } from '@nestjs/common';
import { CancelReservationUseCase } from '../core/application/use-cases/reservations/cancel-reservation.use-case';
import { CreateReservationUseCase } from '../core/application/use-cases/reservations/create-reservation.use-case';
import { ExpireOverdueReservationsUseCase } from '../core/application/use-cases/reservations/expire-overdue-reservations.use-case';
import { GetReservationUseCase } from '../core/application/use-cases/reservations/get-reservation.use-case';
import { ListReservationsUseCase } from '../core/application/use-cases/reservations/list-reservations.use-case';
import {
  CANCEL_RESERVATION,
  CREATE_RESERVATION,
  EXPIRE_OVERDUE_RESERVATIONS,
  GET_RESERVATION,
  LIST_RESERVATIONS,
} from '../core/ports/in/tokens';
import { ReservationsController } from '../adapters/in/http/controllers/reservations.controller';

@Module({
  controllers: [ReservationsController],
  providers: [
    CreateReservationUseCase,
    CancelReservationUseCase,
    GetReservationUseCase,
    ListReservationsUseCase,
    ExpireOverdueReservationsUseCase,
    { provide: CREATE_RESERVATION, useExisting: CreateReservationUseCase },
    { provide: CANCEL_RESERVATION, useExisting: CancelReservationUseCase },
    { provide: GET_RESERVATION, useExisting: GetReservationUseCase },
    { provide: LIST_RESERVATIONS, useExisting: ListReservationsUseCase },
    {
      provide: EXPIRE_OVERDUE_RESERVATIONS,
      useExisting: ExpireOverdueReservationsUseCase,
    },
  ],
  exports: [EXPIRE_OVERDUE_RESERVATIONS],
})
export class ReservationsModule {}
