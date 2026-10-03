import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import type { ParkingSlotRepositoryPort } from '../../../ports/out/parking-slot.repository.port';
import {
  BRANCH_REPOSITORY,
  PARKING_SLOT_REPOSITORY,
} from '../../../ports/out/tokens';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import {
  computeOccupancyLevel,
  OccupancyLevel,
} from '../../shared/occupancy-level';
import type { CompareBranchesOccupancyPort } from '../../../ports/in/branches/compare-branches-occupancy.port';

export interface BranchOccupancyResult {
  branch: Branch;
  totalSlots: number;
  occupiedOrReserved: number;
  level: OccupancyLevel;
}

@Injectable()
export class CompareBranchesOccupancyUseCase implements CompareBranchesOccupancyPort {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
    @Inject(PARKING_SLOT_REPOSITORY)
    private readonly slots: ParkingSlotRepositoryPort,
  ) {}

  async execute(branchIds?: string[]): Promise<BranchOccupancyResult[]> {
    const branches = branchIds?.length
      ? await this.branches.findByIds(branchIds)
      : await this.branches.findAll();
    const summaries = await this.slots.getOccupancySummary(
      branches.map((branch) => branch.id),
    );
    const summaryMap = new Map(
      summaries.map((summary) => [summary.branchId, summary]),
    );

    return branches.map((branch) => {
      const summary = summaryMap.get(branch.id);
      const total = summary?.totalSlots ?? 0;
      const occupied = summary?.occupiedOrReserved ?? 0;
      return {
        branch,
        totalSlots: total,
        occupiedOrReserved: occupied,
        level: computeOccupancyLevel(occupied, total),
      };
    });
  }
}
