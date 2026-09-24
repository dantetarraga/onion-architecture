import { Global, Module } from '@nestjs/common';
import { AesGcmSecretCipherAdapter } from '../adapters/out/auth/aes-gcm-secret-cipher.adapter';
import { BcryptPasswordHasherAdapter } from '../adapters/out/auth/bcrypt-password-hasher.adapter';
import { FacebookGraphTokenAdapter } from '../adapters/out/auth/facebook-graph-token.adapter';
import { FirebaseGoogleTokenAdapter } from '../adapters/out/auth/firebase-google-token.adapter';
import { JwtTokenAdapter } from '../adapters/out/auth/jwt-token.adapter';
import { Rfc6238TotpAdapter } from '../adapters/out/auth/rfc6238-totp.adapter';
import { SystemClockAdapter } from '../adapters/out/clock/system-clock.adapter';
import {
  CLOCK,
  FACEBOOK_TOKEN_VERIFIER,
  GOOGLE_TOKEN_VERIFIER,
  PASSWORD_HASHER,
  SECRET_CIPHER,
  TOKEN_SERVICE,
  TOTP,
} from '../core/ports/out/tokens';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClockAdapter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenAdapter },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasherAdapter },
    { provide: GOOGLE_TOKEN_VERIFIER, useClass: FirebaseGoogleTokenAdapter },
    { provide: FACEBOOK_TOKEN_VERIFIER, useClass: FacebookGraphTokenAdapter },
    { provide: TOTP, useClass: Rfc6238TotpAdapter },
    { provide: SECRET_CIPHER, useClass: AesGcmSecretCipherAdapter },
  ],
  exports: [
    CLOCK,
    TOKEN_SERVICE,
    PASSWORD_HASHER,
    GOOGLE_TOKEN_VERIFIER,
    FACEBOOK_TOKEN_VERIFIER,
    TOTP,
    SECRET_CIPHER,
  ],
})
export class CoreInfraModule {}
