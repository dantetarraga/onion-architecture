import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { MfaAlreadyEnabledError } from '../../../domain/errors/mfa-already-enabled.error';
import type { SetupMfaPort } from '../../../ports/in/auth/setup-mfa.port';
import type { SecretCipherPort } from '../../../ports/out/secret-cipher.port';
import type { TotpPort } from '../../../ports/out/totp.port';
import {
  SECRET_CIPHER,
  TOTP,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';

export interface SetupMfaInput {
  userId: string;
}

export interface SetupMfaResult {
  /** Secreto en base32, por si el usuario prefiere teclearlo en la app en vez de escanear. */
  secret: string;
  /** `otpauth://totp/...` para renderizar como QR. */
  otpauthUri: string;
}

/** Nombre que muestra Google Authenticator arriba del codigo. */
export const MFA_ISSUER = 'Parking/OS';

/**
 * Paso 1 de la activacion: genera un secreto nuevo y lo deja guardado *sin
 * activar* (mfaEnabled sigue en false). Recien ConfirmMfaUseCase, al recibir
 * un primer codigo correcto, enciende el flag: asi un usuario que cierra la
 * pantalla a mitad de camino no queda bloqueado fuera de su cuenta.
 */
@Injectable()
export class SetupMfaUseCase implements SetupMfaPort {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOTP) private readonly totp: TotpPort,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
  ) {}

  async execute(input: SetupMfaInput): Promise<SetupMfaResult> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User', input.userId);
    }
    if (user.mfaEnabled) {
      throw new MfaAlreadyEnabledError();
    }

    const secret = this.totp.generateSecret();
    await this.users.updateMfa(user.id, {
      enabled: false,
      totpSecretEnc: this.cipher.encrypt(secret),
      lastStep: null,
      backupCodeHashes: [],
    });

    return {
      secret,
      otpauthUri: this.totp.buildOtpAuthUri({
        secret,
        accountName: user.email,
        issuer: MFA_ISSUER,
      }),
    };
  }
}
