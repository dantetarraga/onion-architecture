import { Module } from '@nestjs/common';
import { CancelReservationUseCase } from '../core/application/use-cases/reservations/cancel-reservation.use-case';
import { CreateReservationUseCase } from '../core/application/use-cases/reservations/create-reservation.use-case';
import { ExpireOverdueReservationsUseCase } from '../core/application/use-cases/reservations/expire-overdue-reservations.use-case';
import { GetReservationUseCase } from '../core/application/use-cases/reservations/get-reservation.use-case';
import { ListReservationsUseCase } from '../core/application/use-cases/reservations/list-reservations.use-case';
import { ProcessReservationRequestUseCase } from '../core/application/use-cases/reservations/process-reservation-request.use-case';
import { RequestReservationUseCase } from '../core/application/use-cases/reservations/request-reservation.use-case';
import {
  CANCEL_RESERVATION,
  CREATE_RESERVATION,
  EXPIRE_OVERDUE_RESERVATIONS,
  GET_RESERVATION,
  LIST_RESERVATIONS,
  PROCESS_RESERVATION_REQUEST,
  REQUEST_RESERVATION,
} from '../core/ports/in/tokens';
import { ReservationsController } from '../adapters/in/http/controllers/reservations.controller';

@Module({
  controllers: [ReservationsController],
  providers: [
    CreateReservationUseCase,
    RequestReservationUseCase,
    ProcessReservationRequestUseCase,
    CancelReservationUseCase,
    GetReservationUseCase,
    ListReservationsUseCase,
    ExpireOverdueReservationsUseCase,
    { provide: CREATE_RESERVATION, useExisting: CreateReservationUseCase },
    { provide: REQUEST_RESERVATION, useExisting: RequestReservationUseCase },
    {
      provide: PROCESS_RESERVATION_REQUEST,
      useExisting: ProcessReservationRequestUseCase,
    },
    { provide: CANCEL_RESERVATION, useExisting: CancelReservationUseCase },
    { provide: GET_RESERVATION, useExisting: GetReservationUseCase },
    { provide: LIST_RESERVATIONS, useExisting: ListReservationsUseCase },
    {
      provide: EXPIRE_OVERDUE_RESERVATIONS,
      useExisting: ExpireOverdueReservationsUseCase,
    },
  ],
  // PROCESS_RESERVATION_REQUEST lo consume el adaptador de mensajeria del worker.
  exports: [EXPIRE_OVERDUE_RESERVATIONS, PROCESS_RESERVATION_REQUEST],
})
export class ReservationsModule {}
