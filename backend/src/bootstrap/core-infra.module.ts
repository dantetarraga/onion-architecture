import { Global, Module } from '@nestjs/common';
import { CLOCK, PASSWORD_HASHER, QR_CODE, TOKEN_SERVICE } from '../core/ports/out/tokens';
import { PAYMENT_METHOD } from '../core/ports/out/tokens';
import { BcryptPasswordHasherAdapter } from '../adapters/out/auth/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from '../adapters/out/auth/jwt-token.adapter';
import { SystemClockAdapter } from '../adapters/out/clock/system-clock.adapter';
import { CardPaymentAdapter } from '../adapters/out/payments/card-payment.adapter';
import { CashPaymentAdapter } from '../adapters/out/payments/cash-payment.adapter';
import { PaymentMethodRouterAdapter } from '../adapters/out/payments/payment-method-router.adapter';
import { PlinPaymentAdapter } from '../adapters/out/payments/plin-payment.adapter';
import { YapePaymentAdapter } from '../adapters/out/payments/yape-payment.adapter';
import { HmacQrCodeAdapter } from '../adapters/out/qr/hmac-qrcode.adapter';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClockAdapter },
    { provide: QR_CODE, useClass: HmacQrCodeAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenAdapter },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasherAdapter },
    CashPaymentAdapter,
    CardPaymentAdapter,
    YapePaymentAdapter,
    PlinPaymentAdapter,
    { provide: PAYMENT_METHOD, useClass: PaymentMethodRouterAdapter },
  ],
  exports: [CLOCK, QR_CODE, TOKEN_SERVICE, PASSWORD_HASHER, PAYMENT_METHOD],
})
export class CoreInfraModule {}
