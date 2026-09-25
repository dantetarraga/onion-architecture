import { Module } from '@nestjs/common';
import { GetPaymentBySessionUseCase } from '../core/application/use-cases/payments/get-payment-by-session.use-case';
import { GetPaymentUseCase } from '../core/application/use-cases/payments/get-payment.use-case';
import { ListUserPaymentsUseCase } from '../core/application/use-cases/payments/list-user-payments.use-case';
import { RegisterPaymentUseCase } from '../core/application/use-cases/payments/register-payment.use-case';
import { SumApprovedByBranchUseCase } from '../core/application/use-cases/payments/sum-approved-by-branch.use-case';
import {
  GET_PAYMENT,
  GET_PAYMENT_BY_SESSION,
  LIST_USER_PAYMENTS,
  REGISTER_PAYMENT,
  SUM_APPROVED_BY_BRANCH,
} from '../core/ports/in/tokens';
import { PaymentsGrpcController } from '../adapters/in/grpc/payments.grpc-controller';
import { PaymentsController } from '../adapters/in/http/controllers/payments.controller';
import { UserPaymentsController } from '../adapters/in/http/controllers/user-payments.controller';

@Module({
  controllers: [PaymentsController, UserPaymentsController, PaymentsGrpcController],
  providers: [
    RegisterPaymentUseCase,
    GetPaymentUseCase,
    ListUserPaymentsUseCase,
    GetPaymentBySessionUseCase,
    SumApprovedByBranchUseCase,
    { provide: REGISTER_PAYMENT, useExisting: RegisterPaymentUseCase },
    { provide: GET_PAYMENT, useExisting: GetPaymentUseCase },
    { provide: LIST_USER_PAYMENTS, useExisting: ListUserPaymentsUseCase },
    { provide: GET_PAYMENT_BY_SESSION, useExisting: GetPaymentBySessionUseCase },
    { provide: SUM_APPROVED_BY_BRANCH, useExisting: SumApprovedByBranchUseCase },
  ],
})
export class PaymentsModule {}
