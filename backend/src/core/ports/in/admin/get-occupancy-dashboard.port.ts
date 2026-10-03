import type { BranchOccupancyResult } from '../../../application/use-cases/branches/compare-branches-occupancy.use-case';

export interface GetOccupancyDashboardPort {
  execute(): Promise<BranchOccupancyResult[]>;
}
