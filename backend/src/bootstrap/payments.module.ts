import { Module } from '@nestjs/common';
import { GetPaymentUseCase } from '../core/application/use-cases/payments/get-payment.use-case';
import { RegisterPaymentUseCase } from '../core/application/use-cases/payments/register-payment.use-case';
import { GET_PAYMENT, REGISTER_PAYMENT } from '../core/ports/in/tokens';
import { PaymentsController } from '../adapters/in/http/controllers/payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [
    RegisterPaymentUseCase,
    GetPaymentUseCase,
    { provide: REGISTER_PAYMENT, useExisting: RegisterPaymentUseCase },
    { provide: GET_PAYMENT, useExisting: GetPaymentUseCase },
  ],
})
export class PaymentsModule {}
