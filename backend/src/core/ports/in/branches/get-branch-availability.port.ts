import type { BranchAvailabilityResult } from '../../../application/use-cases/branches/get-branch-availability.use-case';

export interface GetBranchAvailabilityPort {
  execute(branchId: string): Promise<BranchAvailabilityResult>;
}
