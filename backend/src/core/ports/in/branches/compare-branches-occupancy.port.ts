import type { BranchOccupancyResult } from '../../../application/use-cases/branches/compare-branches-occupancy.use-case';

export interface CompareBranchesOccupancyPort {
  execute(branchIds?: string[]): Promise<BranchOccupancyResult[]>;
}
