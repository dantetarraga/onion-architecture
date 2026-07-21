import { Branch } from '../../entities/branch.entity';
import { BranchRepositoryPort } from '../../ports/branch.repository.port';
import { ParkingSlotRepositoryPort } from '../../ports/parking-slot.repository.port';
import {
  SlotAssignmentInput,
  SlotAssignmentPolicy,
  SlotAssignmentResult,
} from '../slot-assignment.policy';

/** Km "equivalentes" penalizados por cada 100% de ocupacion adicional al rankear sucursales cercanas. */
const OCCUPANCY_PENALTY_KM = 5;

/**
 * V2 de la Politica 1, intercambiable con DefaultSlotAssignmentPolicy via
 * SLOT_ASSIGNMENT_STRATEGY. Difiere en dos reglas:
 *  - Dentro de la sucursal elegida: reclama la cochera menos usada recientemente
 *    (en vez de la primera por codigo), para repartir el desgaste fisico.
 *  - Sugerencia cross-sucursal: rankea por un score compuesto distancia + ocupacion,
 *    en vez de solo distancia, para no mandar siempre al vecino mas cercano si esta casi lleno.
 */
export class BalancedSlotAssignmentPolicy implements SlotAssignmentPolicy {
  constructor(
    private readonly slots: ParkingSlotRepositoryPort,
    private readonly branches: BranchRepositoryPort,
  ) {}

  async assign(input: SlotAssignmentInput): Promise<SlotAssignmentResult> {
    const claimed = await this.slots.claimLeastRecentlyUsedSlot(
      input.branchId,
      input.slotType,
    );
    if (claimed) {
      return { outcome: 'ASSIGNED', slot: claimed };
    }

    const currentBranch = await this.branches.findById(input.branchId);
    if (!currentBranch) {
      return { outcome: 'NO_AVAILABILITY' };
    }

    const otherBranches = await this.branches.findAllExcept(input.branchId);
    const availabilityFlags = await Promise.all(
      otherBranches.map((branch) =>
        this.slots.hasAvailability(branch.id, input.slotType),
      ),
    );
    const candidates = otherBranches.filter(
      (_, index) => availabilityFlags[index],
    );

    if (candidates.length === 0) {
      return { outcome: 'NO_AVAILABILITY' };
    }

    const summaries = await this.slots.getOccupancySummary(
      candidates.map((branch) => branch.id),
    );
    const occupancyByBranch = new Map(
      summaries.map((summary) => [summary.branchId, summary]),
    );

    const ranked = candidates
      .map((branch) => this.score(currentBranch, branch, occupancyByBranch))
      .sort((a, b) => a.score - b.score);

    const best = ranked[0];
    return {
      outcome: 'SUGGEST_OTHER_BRANCH',
      suggestedBranch: best.branch,
      distanceKm: best.distanceKm,
    };
  }

  private score(
    currentBranch: Branch,
    branch: Branch,
    occupancyByBranch: Map<
      string,
      { totalSlots: number; occupiedOrReserved: number }
    >,
  ): { branch: Branch; distanceKm: number; score: number } {
    const distanceKm = currentBranch.distanceKmTo(branch);
    const summary = occupancyByBranch.get(branch.id);
    const occupancyRatio =
      summary && summary.totalSlots > 0
        ? summary.occupiedOrReserved / summary.totalSlots
        : 0;
    const score = distanceKm + occupancyRatio * OCCUPANCY_PENALTY_KM;
    return { branch, distanceKm, score };
  }
}
