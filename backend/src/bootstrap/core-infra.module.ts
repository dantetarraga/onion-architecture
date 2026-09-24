import { Global, Module } from '@nestjs/common';
import { Rs256PublicKeyVerifierAdapter } from '../adapters/out/auth/rs256-public-key-verifier.adapter';
import { SystemClockAdapter } from '../adapters/out/clock/system-clock.adapter';
import { CardPaymentAdapter } from '../adapters/out/payments/card-payment.adapter';
import { CashPaymentAdapter } from '../adapters/out/payments/cash-payment.adapter';
import { PaymentMethodRouterAdapter } from '../adapters/out/payments/payment-method-router.adapter';
import { PlinPaymentAdapter } from '../adapters/out/payments/plin-payment.adapter';
import { YapePaymentAdapter } from '../adapters/out/payments/yape-payment.adapter';
import { HmacQrCodeAdapter } from '../adapters/out/qr/hmac-qrcode.adapter';
import {
  CLOCK,
  PAYMENT_METHOD,
  PUBLIC_KEY_VERIFIER,
  QR_CODE,
} from '../core/ports/out/tokens';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClockAdapter },
    { provide: QR_CODE, useClass: HmacQrCodeAdapter },
    { provide: PUBLIC_KEY_VERIFIER, useClass: Rs256PublicKeyVerifierAdapter },
    CashPaymentAdapter,
    CardPaymentAdapter,
    YapePaymentAdapter,
    PlinPaymentAdapter,
    { provide: PAYMENT_METHOD, useClass: PaymentMethodRouterAdapter },
  ],
  exports: [CLOCK, QR_CODE, PUBLIC_KEY_VERIFIER, PAYMENT_METHOD],
})
export class CoreInfraModule {}
