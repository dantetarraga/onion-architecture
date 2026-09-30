import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import {
  paymentsAmount,
  paymentsRegistered,
} from '../../../../observability/metrics';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(REGISTER_PAYMENT)
    private readonly registerPayment: RegisterPaymentPort,
    @Inject(GET_PAYMENT) private readonly getPayment: GetPaymentPort,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: RegisterPaymentDto,
  ) {
    const payment = await this.registerPayment.execute({
      sessionId: dto.sessionId,
      userId: user.sub,
      method: dto.method,
    });
    paymentsRegistered.inc({ method: dto.method, status: payment.status });
    if (payment.isApproved()) {
      paymentsAmount.inc({ method: dto.method }, payment.amount);
    }
    return payment;
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getPayment.execute(id);
  }
}
