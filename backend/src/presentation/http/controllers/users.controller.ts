import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListUserSessionsUseCase } from '../../../application/use-cases/parking/list-user-sessions.use-case';
import { ListUserPaymentsUseCase } from '../../../application/use-cases/payments/list-user-payments.use-case';
import { ListUserReservationsUseCase } from '../../../application/use-cases/reservations/list-user-reservations.use-case';
import { GetCurrentUserUseCase } from '../../../application/use-cases/users/get-current-user.use-case';
import type { AuthTokenPayload } from '../../../application/ports/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly listUserReservations: ListUserReservationsUseCase,
    private readonly listUserSessions: ListUserSessionsUseCase,
    private readonly listUserPayments: ListUserPaymentsUseCase,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthTokenPayload) {
    return this.getCurrentUser.execute(user.sub);
  }

  @Get('me/reservations')
  myReservations(@CurrentUser() user: AuthTokenPayload) {
    return this.listUserReservations.execute(user.sub);
  }

  @Get('me/sessions')
  mySessions(@CurrentUser() user: AuthTokenPayload) {
    return this.listUserSessions.execute(user.sub);
  }

  @Get('me/payments')
  myPayments(@CurrentUser() user: AuthTokenPayload) {
    return this.listUserPayments.execute(user.sub);
  }
}
