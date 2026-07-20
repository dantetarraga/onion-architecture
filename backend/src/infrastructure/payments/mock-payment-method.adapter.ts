import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChargeInput, ChargeResult, PaymentMethod } from '../../domain/policies/payment-method.port';

/**
 * Implementacion Mock del metodo de pago (siempre aprueba). Vive en
 * infrastructure porque simula un servicio externo, no una regla de negocio.
 */
@Injectable()
export class MockPaymentMethodAdapter implements PaymentMethod {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    void input;
    return {
      status: 'APPROVED',
      externalReference: `MOCK-${randomUUID()}`,
    };
  }
}
