import { Injectable } from '@nestjs/common';
import { PaymentMethodType } from '../../domain/enums/payment-method-type.enum';
import { ChargeInput, ChargeResult, PaymentMethod } from '../../domain/policies/payment-method.port';
import { CardPaymentAdapter } from './card-payment.adapter';
import { CashPaymentAdapter } from './cash-payment.adapter';
import { PlinPaymentAdapter } from './plin-payment.adapter';
import { YapePaymentAdapter } from './yape-payment.adapter';

/**
 * Strategy + Factory: delega el cobro al mini-adapter del metodo elegido por el
 * usuario. Agregar un metodo de pago nuevo es un adapter mas + una linea aqui,
 * sin tocar RegisterPaymentUseCase.
 */
@Injectable()
export class PaymentMethodRouterAdapter implements PaymentMethod {
  private readonly adapters: Record<PaymentMethodType, PaymentMethod>;

  constructor(
    cash: CashPaymentAdapter,
    card: CardPaymentAdapter,
    yape: YapePaymentAdapter,
    plin: PlinPaymentAdapter,
  ) {
    this.adapters = {
      [PaymentMethodType.CASH]: cash,
      [PaymentMethodType.CARD]: card,
      [PaymentMethodType.YAPE]: yape,
      [PaymentMethodType.PLIN]: plin,
    };
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    return this.adapters[input.method].charge(input);
  }
}
