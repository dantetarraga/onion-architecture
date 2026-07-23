import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChargeInput, ChargeResult, PaymentMethod } from '../../domain/policies/payment-method.port';

/** Mock del metodo de pago Plin (Politica 8: rechaza solo si monto <= 0). */
@Injectable()
export class PlinPaymentAdapter implements PaymentMethod {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    return {
      status: input.amount > 0 ? 'APPROVED' : 'REJECTED',
      externalReference: `PLIN-${randomUUID()}`,
    };
  }
}
