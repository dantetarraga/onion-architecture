import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import type { ParkingSlotRepositoryPort } from '../../../ports/out/parking-slot.repository.port';
import {
  BRANCH_REPOSITORY,
  PARKING_SLOT_REPOSITORY,
} from '../../../ports/out/tokens';
import type { RealtimeNotifierPort } from '../../../ports/out/realtime-notifier.port';
import { REALTIME_NOTIFIER } from '../../../ports/out/tokens';
import type { SimulateBranchFullPort } from '../../../ports/in/admin/simulate-branch-full.port';

/** Fuerza todas las cocheras de una sucursal a OCUPADA, para demostrar la Politica 1 en vivo. */
@Injectable()
export class SimulateBranchFullUseCase implements SimulateBranchFullPort {
  constructor(
    @Inject(PARKING_SLOT_REPOSITORY)
    private readonly slots: ParkingSlotRepositoryPort,
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(branchId: string): Promise<void> {
    const branch = await this.branches.findById(branchId);
    if (!branch) {
      throw new NotFoundError('Branch', branchId);
    }

    await this.slots.markAllOccupied(branchId);
    this.notifier.notifyOccupancyUpdated(branchId);
  }
}
