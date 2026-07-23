import { PaymentMethodType } from '../../domain/enums/payment-method-type.enum';
import { CardPaymentAdapter } from './card-payment.adapter';
import { CashPaymentAdapter } from './cash-payment.adapter';
import { PaymentMethodRouterAdapter } from './payment-method-router.adapter';
import { PlinPaymentAdapter } from './plin-payment.adapter';
import { YapePaymentAdapter } from './yape-payment.adapter';

describe('PaymentMethodRouterAdapter', () => {
  let router: PaymentMethodRouterAdapter;

  beforeEach(() => {
    router = new PaymentMethodRouterAdapter(
      new CashPaymentAdapter(),
      new CardPaymentAdapter(),
      new YapePaymentAdapter(),
      new PlinPaymentAdapter(),
    );
  });

  it.each([
    [PaymentMethodType.CASH, 'CASH-'],
    [PaymentMethodType.CARD, 'CARD-'],
    [PaymentMethodType.YAPE, 'YAPE-'],
    [PaymentMethodType.PLIN, 'PLIN-'],
  ])('aprueba el cobro con %s y usa el prefijo %s en la referencia externa', async (method, prefix) => {
    const result = await router.charge({ sessionId: 'session-1', amount: 10, currency: 'PEN', method });

    expect(result.status).toBe('APPROVED');
    expect(result.externalReference.startsWith(prefix)).toBe(true);
  });

  it.each([PaymentMethodType.CASH, PaymentMethodType.CARD, PaymentMethodType.YAPE, PaymentMethodType.PLIN])(
    'rechaza el cobro con %s si el monto es <= 0 (Politica 8)',
    async (method) => {
      const result = await router.charge({ sessionId: 'session-1', amount: 0, currency: 'PEN', method });

      expect(result.status).toBe('REJECTED');
    },
  );
});
