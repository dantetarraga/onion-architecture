import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ListUserReservationsPort } from '../../../../core/ports/in/reservations/list-user-reservations.port';
import type { ListUserSessionsPort } from '../../../../core/ports/in/parking/list-user-sessions.port';
import {
  LIST_USER_RESERVATIONS,
  LIST_USER_SESSIONS,
} from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * `GET /users/me` (perfil) vive en `gateway` desde la extraccion de auth-service: necesita datos de User.
 * `GET /users/me/payments` vive en payments-service desde su extraccion (gateway lo enruta alla).
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    @Inject(LIST_USER_RESERVATIONS)
    private readonly listUserReservations: ListUserReservationsPort,
    @Inject(LIST_USER_SESSIONS)
    private readonly listUserSessions: ListUserSessionsPort,
  ) {}

  @Get('me/reservations')
  myReservations(@CurrentUser() user: AuthTokenPayload) {
    return this.listUserReservations.execute(user.sub);
  }

  @Get('me/sessions')
  mySessions(@CurrentUser() user: AuthTokenPayload) {
    return this.listUserSessions.execute(user.sub);
  }
}
