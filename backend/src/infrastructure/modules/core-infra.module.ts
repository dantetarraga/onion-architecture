import { Global, Module } from '@nestjs/common';
import { CLOCK, PASSWORD_HASHER, QR_CODE, TOKEN_SERVICE } from '../../application/ports/tokens';
import { PAYMENT_METHOD } from '../../domain/ports/tokens';
import { BcryptPasswordHasherAdapter } from '../auth/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from '../auth/jwt-token.adapter';
import { SystemClockAdapter } from '../clock/system-clock.adapter';
import { MockPaymentMethodAdapter } from '../payments/mock-payment-method.adapter';
import { HmacQrCodeAdapter } from '../qr/hmac-qrcode.adapter';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClockAdapter },
    { provide: QR_CODE, useClass: HmacQrCodeAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenAdapter },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasherAdapter },
    { provide: PAYMENT_METHOD, useClass: MockPaymentMethodAdapter },
  ],
  exports: [CLOCK, QR_CODE, TOKEN_SERVICE, PASSWORD_HASHER, PAYMENT_METHOD],
})
export class CoreInfraModule {}
