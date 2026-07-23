import { PaymentMethodType } from '../enums/payment-method-type.enum';

export interface ChargeInput {
  sessionId: string;
  amount: number;
  currency: 'PEN';
  method: PaymentMethodType;
}

export interface ChargeResult {
  status: 'APPROVED' | 'REJECTED';
  externalReference: string;
}

/**
 * Resuelve el cobro de una sesion. Implementacion actual: Mock. Intercambiable
 * por una pasarela real (Stripe/Culqi) sin tocar los casos de uso.
 */
export interface PaymentMethod {
  charge(input: ChargeInput): Promise<ChargeResult>;
}
