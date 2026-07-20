import { BranchRepositoryPort } from '../../ports/branch.repository.port';
import { ParkingSlotRepositoryPort } from '../../ports/parking-slot.repository.port';
import { SlotAssignmentInput, SlotAssignmentPolicy, SlotAssignmentResult } from '../slot-assignment.policy';

/**
 * V1 de la Politica 1: primera cochera disponible del tipo pedido en la
 * sucursal elegida; si no hay, sugiere la sucursal cercana (Haversine) con
 * cupo del mismo tipo, ordenando por distancia.
 */
export class DefaultSlotAssignmentPolicy implements SlotAssignmentPolicy {
  constructor(
    private readonly slots: ParkingSlotRepositoryPort,
    private readonly branches: BranchRepositoryPort,
  ) {}

  async assign(input: SlotAssignmentInput): Promise<SlotAssignmentResult> {
    const claimed = await this.slots.claimAvailableSlot(input.branchId, input.slotType);
    if (claimed) {
      return { outcome: 'ASSIGNED', slot: claimed };
    }

    const currentBranch = await this.branches.findById(input.branchId);
    if (!currentBranch) {
      return { outcome: 'NO_AVAILABILITY' };
    }

    const otherBranches = await this.branches.findAllExcept(input.branchId);
    const ranked = otherBranches
      .map((branch) => ({ branch, distanceKm: currentBranch.distanceKmTo(branch) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    for (const candidate of ranked) {
      const hasAvailability = await this.slots.hasAvailability(candidate.branch.id, input.slotType);
      if (hasAvailability) {
        return {
          outcome: 'SUGGEST_OTHER_BRANCH',
          suggestedBranch: candidate.branch,
          distanceKm: candidate.distanceKm,
        };
      }
    }

    return { outcome: 'NO_AVAILABILITY' };
  }
}
