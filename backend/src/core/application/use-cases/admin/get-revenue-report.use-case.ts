import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import type { PaymentLookupPort } from '../../../ports/out/payment-lookup.port';
import {
  BRANCH_REPOSITORY,
  PAYMENT_LOOKUP,
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

/**
 * Las sucursales son de backend y los montos de payments-service: el reporte
 * los une en memoria con UNA sola llamada gRPC para todas las sucursales (en
 * el monolito era un aggregate por sucursal sobre la misma base).
 */
@Injectable()
export class GetRevenueReportUseCase implements GetRevenueReportPort {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
    @Inject(PAYMENT_LOOKUP)
    private readonly payments: PaymentLookupPort,
  ) {}

  async execute(input: RevenueReportInput): Promise<RevenueReportRow[]> {
    const branches = input.branchId
      ? await this.branches.findByIds([input.branchId])
      : await this.branches.findAll();
    if (branches.length === 0) {
      return [];
    }

    const revenue = await this.payments.sumApprovedByBranch(
      branches.map((branch) => branch.id),
      input.from,
      input.to,
    );
    const totals = new Map(revenue.map((row) => [row.branchId, row.total]));

    return branches.map((branch) => ({
      branch,
      totalRevenue: totals.get(branch.id) ?? 0,
    }));
  }
}
