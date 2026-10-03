import { Global, Module } from '@nestjs/common';
import { Rs256PublicKeyVerifierAdapter } from '../adapters/out/auth/rs256-public-key-verifier.adapter';
import { SystemClockAdapter } from '../adapters/out/clock/system-clock.adapter';
import { HmacQrCodeAdapter } from '../adapters/out/qr/hmac-qrcode.adapter';
import {
  CLOCK,
  PUBLIC_KEY_VERIFIER,
  QR_CODE,
} from '../core/ports/out/tokens';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClockAdapter },
    { provide: QR_CODE, useClass: HmacQrCodeAdapter },
    { provide: PUBLIC_KEY_VERIFIER, useClass: Rs256PublicKeyVerifierAdapter },
  ],
  exports: [CLOCK, QR_CODE, PUBLIC_KEY_VERIFIER],
})
export class CoreInfraModule {}
