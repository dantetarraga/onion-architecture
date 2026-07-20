import { Injectable } from '@nestjs/common';
import {
  BranchOccupancyResult,
  CompareBranchesOccupancyUseCase,
} from '../branches/compare-branches-occupancy.use-case';

@Injectable()
export class GetOccupancyDashboardUseCase {
  constructor(private readonly compareBranchesOccupancy: CompareBranchesOccupancyUseCase) {}

  async execute(): Promise<BranchOccupancyResult[]> {
    return this.compareBranchesOccupancy.execute();
  }
}
