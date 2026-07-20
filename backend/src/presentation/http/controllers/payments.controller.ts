import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetPaymentUseCase } from '../../../application/use-cases/payments/get-payment.use-case';
import { RegisterPaymentUseCase } from '../../../application/use-cases/payments/register-payment.use-case';
import type { AuthTokenPayload } from '../../../application/ports/token.port';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RegisterPaymentDto } from '../dto/payments/register-payment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly registerPayment: RegisterPaymentUseCase,
    private readonly getPayment: GetPaymentUseCase,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body() dto: RegisterPaymentDto) {
    return this.registerPayment.execute({ sessionId: dto.sessionId, userId: user.sub });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getPayment.execute(id);
  }
}
