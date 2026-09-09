import { Injectable } from '@nestjs/common';
import {
  BranchOccupancyResult,
  CompareBranchesOccupancyUseCase,
} from '../branches/compare-branches-occupancy.use-case';
import type { GetOccupancyDashboardPort } from '../../../ports/in/admin/get-occupancy-dashboard.port';

@Injectable()
export class GetOccupancyDashboardUseCase implements GetOccupancyDashboardPort {
  constructor(
    private readonly compareBranchesOccupancy: CompareBranchesOccupancyUseCase,
  ) {}

  async execute(): Promise<BranchOccupancyResult[]> {
    return this.compareBranchesOccupancy.execute();
  }
}
