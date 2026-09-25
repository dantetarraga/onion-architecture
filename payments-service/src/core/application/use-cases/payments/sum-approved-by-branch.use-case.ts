import { Inject, Injectable } from '@nestjs/common';
import type {
  BranchRevenue,
  PaymentRepositoryPort,
} from '../../../ports/out/payment.repository.port';
import { PAYMENT_REPOSITORY } from '../../../ports/out/tokens';
import type {
  SumApprovedByBranchInput,
  SumApprovedByBranchPort,
} from '../../../ports/in/payments/sum-approved-by-branch.port';

/** Lo consume backend (via gRPC) para el reporte de ingresos del admin. */
@Injectable()
export class SumApprovedByBranchUseCase implements SumApprovedByBranchPort {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
  ) {}

  execute(input: SumApprovedByBranchInput): Promise<BranchRevenue[]> {
    return this.payments.sumApprovedByBranch(input.branchIds, input.from, input.to);
  }
}
