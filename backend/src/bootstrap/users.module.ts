import { Module } from '@nestjs/common';
import { ListUserSessionsUseCase } from '../core/application/use-cases/parking/list-user-sessions.use-case';
import { ListUserPaymentsUseCase } from '../core/application/use-cases/payments/list-user-payments.use-case';
import { ListUserReservationsUseCase } from '../core/application/use-cases/reservations/list-user-reservations.use-case';
import { GetCurrentUserUseCase } from '../core/application/use-cases/users/get-current-user.use-case';
import {
  GET_CURRENT_USER,
  LIST_USER_PAYMENTS,
  LIST_USER_RESERVATIONS,
  LIST_USER_SESSIONS,
} from '../core/ports/in/tokens';
import { UsersController } from '../adapters/in/http/controllers/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    GetCurrentUserUseCase,
    ListUserReservationsUseCase,
    ListUserSessionsUseCase,
    ListUserPaymentsUseCase,
    { provide: GET_CURRENT_USER, useExisting: GetCurrentUserUseCase },
    {
      provide: LIST_USER_RESERVATIONS,
      useExisting: ListUserReservationsUseCase,
    },
    { provide: LIST_USER_SESSIONS, useExisting: ListUserSessionsUseCase },
    { provide: LIST_USER_PAYMENTS, useExisting: ListUserPaymentsUseCase },
  ],
})
export class UsersModule {}
