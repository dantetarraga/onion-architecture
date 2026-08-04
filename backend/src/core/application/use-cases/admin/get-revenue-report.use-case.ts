import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import type { PaymentRepositoryPort } from '../../../ports/out/payment.repository.port';
import {
  BRANCH_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../../../ports/out/tokens';
import type { GetRevenueReportPort } from '../../../ports/in/admin/get-revenue-report.port';

export interface RevenueReportInput {
  branchId?: string;
  from?: Date;
  to?: Date;
}

export interface RevenueReportRow {
  branch: Branch;
  totalRevenue: number;
}

@Injectable()
export class GetRevenueReportUseCase implements GetRevenueReportPort {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
  ) {}

  async execute(input: RevenueReportInput): Promise<RevenueReportRow[]> {
    const branches = input.branchId
      ? await this.branches.findByIds([input.branchId])
      : await this.branches.findAll();

    return Promise.all(
      branches.map(async (branch) => ({
        branch,
        totalRevenue: await this.payments.sumApprovedAmountByBranch(
          branch.id,
          input.from,
          input.to,
        ),
      })),
    );
  }
}
