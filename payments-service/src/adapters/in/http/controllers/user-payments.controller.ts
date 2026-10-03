import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { ListUserPaymentsPort } from '../../../../core/ports/in/payments/list-user-payments.port';
import { LIST_USER_PAYMENTS } from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * `GET /users/me/payments` se mantiene en la misma URL que en el monolito:
 * gateway lo enruta aca por path (el resto de /users/me/* sigue en backend,
 * y GET /users/me en el propio gateway).
 */
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserPaymentsController {
  constructor(
    @Inject(LIST_USER_PAYMENTS)
    private readonly listUserPayments: ListUserPaymentsPort,
  ) {}

  @Get('me/payments')
  myPayments(@CurrentUser() user: AuthTokenPayload) {
    return this.listUserPayments.execute(user.sub);
  }
}
