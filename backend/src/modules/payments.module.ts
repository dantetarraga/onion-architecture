import { Module } from '@nestjs/common';
import { GetPaymentUseCase } from '../application/use-cases/payments/get-payment.use-case';
import { RegisterPaymentUseCase } from '../application/use-cases/payments/register-payment.use-case';
import { PaymentsController } from '../presentation/http/controllers/payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [RegisterPaymentUseCase, GetPaymentUseCase],
})
export class PaymentsModule {}
