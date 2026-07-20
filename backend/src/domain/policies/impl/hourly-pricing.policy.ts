import { BranchRepositoryPort } from '../../ports/branch.repository.port';
import { NotFoundError } from '../../errors/not-found.error';
import { PricingInput, PricingPolicy, PricingResult } from '../pricing.policy';

const MS_PER_HOUR = 60 * 60 * 1000;

/** V1 de la Politica 4: tarifa por hora de la sucursal, redondeada hacia arriba. */
export class HourlyPricingPolicy implements PricingPolicy {
  constructor(private readonly branches: BranchRepositoryPort) {}

  async calculate(input: PricingInput): Promise<PricingResult> {
    const branch = await this.branches.findById(input.branchId);
    if (!branch) {
      throw new NotFoundError('Branch', input.branchId);
    }

    const durationMs = Math.max(input.exitAt.getTime() - input.entryAt.getTime(), 0);
    const billableHours = Math.max(Math.ceil(durationMs / MS_PER_HOUR), 1);
    const amount = Number((billableHours * branch.pricePerHour).toFixed(2));

    return {
      amount,
      currency: 'PEN',
      breakdown: [
        {
          label: `${billableHours}h x S/ ${branch.pricePerHour.toFixed(2)} (tarifa por hora)`,
          amount,
        },
      ],
    };
  }
}
