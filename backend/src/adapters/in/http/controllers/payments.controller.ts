import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { GetPaymentPort } from '../../../../core/ports/in/payments/get-payment.port';
import type { RegisterPaymentPort } from '../../../../core/ports/in/payments/register-payment.port';
import {
  GET_PAYMENT,
  REGISTER_PAYMENT,
} from '../../../../core/ports/in/tokens';
import type { AuthTokenPayload } from '../../../../core/ports/out/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RegisterPaymentDto } from '../dto/payments/register-payment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(REGISTER_PAYMENT)
    private readonly registerPayment: RegisterPaymentPort,
    @Inject(GET_PAYMENT) private readonly getPayment: GetPaymentPort,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: RegisterPaymentDto,
  ) {
    return this.registerPayment.execute({
      sessionId: dto.sessionId,
      userId: user.sub,
      method: dto.method,
    });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getPayment.execute(id);
  }
}
