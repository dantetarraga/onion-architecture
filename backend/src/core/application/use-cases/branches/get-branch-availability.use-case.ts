import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import type {
  ParkingSlotRepositoryPort,
  SlotAvailabilityCount,
} from '../../../ports/out/parking-slot.repository.port';
import {
  BRANCH_REPOSITORY,
  PARKING_SLOT_REPOSITORY,
} from '../../../ports/out/tokens';
import type { GetBranchAvailabilityPort } from '../../../ports/in/branches/get-branch-availability.port';

export interface BranchAvailabilityResult {
  branch: Branch;
  availability: SlotAvailabilityCount[];
}

@Injectable()
export class GetBranchAvailabilityUseCase implements GetBranchAvailabilityPort {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
    @Inject(PARKING_SLOT_REPOSITORY)
    private readonly slots: ParkingSlotRepositoryPort,
  ) {}

  async execute(branchId: string): Promise<BranchAvailabilityResult> {
    const branch = await this.branches.findById(branchId);
    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    const availability = await this.slots.countByBranchAndType(branchId);
    return { branch, availability };
  }
}
