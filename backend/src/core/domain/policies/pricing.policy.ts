import { SlotType } from '../enums/slot-type.enum';

export interface PricingInput {
  branchId: string;
  slotType: SlotType;
  entryAt: Date;
  exitAt: Date;
  userId: string;
}

export interface PricingBreakdownItem {
  label: string;
  amount: number;
}

export interface PricingResult {
  amount: number;
  currency: 'PEN';
  breakdown: PricingBreakdownItem[];
}

/**
 * Calcula el monto a cobrar por una sesion de estacionamiento (Politica 4).
 * V1: tarifa por hora de la sucursal. Intercambiable por tarifas dinamicas a futuro.
 */
export interface PricingPolicy {
  calculate(input: PricingInput): Promise<PricingResult>;
}
