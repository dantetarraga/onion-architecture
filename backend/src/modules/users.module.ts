import { Module } from '@nestjs/common';
import { ListUserSessionsUseCase } from '../application/use-cases/parking/list-user-sessions.use-case';
import { ListUserPaymentsUseCase } from '../application/use-cases/payments/list-user-payments.use-case';
import { ListUserReservationsUseCase } from '../application/use-cases/reservations/list-user-reservations.use-case';
import { GetCurrentUserUseCase } from '../application/use-cases/users/get-current-user.use-case';
import { UsersController } from '../presentation/http/controllers/users.controller';

@Module({
  controllers: [UsersController],
  providers: [GetCurrentUserUseCase, ListUserReservationsUseCase, ListUserSessionsUseCase, ListUserPaymentsUseCase],
})
export class UsersModule {}
