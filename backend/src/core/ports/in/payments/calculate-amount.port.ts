import type { PricingResult } from '../../../domain/policies/pricing.policy';
import type { CalculateAmountInput } from '../../../application/use-cases/payments/calculate-amount.use-case';

export interface CalculateAmountPort {
  execute(input: CalculateAmountInput): Promise<PricingResult>;
}
