import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Payment } from '../../../core/domain/entities/payment.entity';
import type { GetPaymentBySessionPort } from '../../../core/ports/in/payments/get-payment-by-session.port';
import type { SumApprovedByBranchPort } from '../../../core/ports/in/payments/sum-approved-by-branch.port';
import {
  GET_PAYMENT_BY_SESSION,
  SUM_APPROVED_BY_BRANCH,
} from '../../../core/ports/in/tokens';
import { callUseCase } from './grpc-domain-error';

function toPaymentReply(payment: Payment) {
  return {
    id: payment.id,
    sessionId: payment.sessionId,
    userId: payment.userId,
    branchId: payment.branchId,
    amount: payment.amount,
    status: payment.status,
    externalReference: payment.externalReference ?? '',
    paidAt: payment.paidAt?.toISOString() ?? '',
    createdAt: payment.createdAt.toISOString(),
  };
}

/** Entrada interna (solo backend). El trafico del navegador entra por HTTP (PaymentsController). */
@Controller()
export class PaymentsGrpcController {
  constructor(
    @Inject(GET_PAYMENT_BY_SESSION)
    private readonly getPaymentBySession: GetPaymentBySessionPort,
    @Inject(SUM_APPROVED_BY_BRANCH)
    private readonly sumApprovedByBranch: SumApprovedByBranchPort,
  ) {}

  @GrpcMethod('PaymentsService', 'GetPaymentBySession')
  async bySession(data: { sessionId: string }) {
    const payment = await callUseCase(() =>
      this.getPaymentBySession.execute(data.sessionId),
    );
    return payment
      ? { found: true, payment: toPaymentReply(payment) }
      : { found: false };
  }

  @GrpcMethod('PaymentsService', 'SumApprovedByBranch')
  async sumByBranch(data: { branchIds?: string[]; from?: string; to?: string }) {
    const rows = await callUseCase(() =>
      this.sumApprovedByBranch.execute({
        branchIds: data.branchIds ?? [],
        from: data.from ? new Date(data.from) : undefined,
        to: data.to ? new Date(data.to) : undefined,
      }),
    );
    return { rows };
  }
}
