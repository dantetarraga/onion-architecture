import type { BranchRevenue } from '../../out/payment.repository.port';

export interface SumApprovedByBranchInput {
  branchIds: string[];
  from?: Date;
  to?: Date;
}

export interface SumApprovedByBranchPort {
  execute(input: SumApprovedByBranchInput): Promise<BranchRevenue[]>;
}
