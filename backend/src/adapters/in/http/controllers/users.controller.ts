import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { GetCurrentUserPort } from '../../../../core/ports/in/users/get-current-user.port';
import type { ListUserPaymentsPort } from '../../../../core/ports/in/payments/list-user-payments.port';
import type { ListUserReservationsPort } from '../../../../core/ports/in/reservations/list-user-reservations.port';
import type { ListUserSessionsPort } from '../../../../core/ports/in/parking/list-user-sessions.port';
import {
  GET_CURRENT_USER,
  LIST_USER_PAYMENTS,
  LIST_USER_RESERVATIONS,
  LIST_USER_SESSIONS,
} from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    @Inject(GET_CURRENT_USER)
    private readonly getCurrentUser: GetCurrentUserPort,
    @Inject(LIST_USER_RESERVATIONS)
    private readonly listUserReservations: ListUserReservationsPort,
    @Inject(LIST_USER_SESSIONS)
    private readonly listUserSessions: ListUserSessionsPort,
    @Inject(LIST_USER_PAYMENTS)
    private readonly listUserPayments: ListUserPaymentsPort,
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
