import { Inject, Injectable } from '@nestjs/common';
import { InvalidMfaCodeError } from '../../../domain/errors/invalid-mfa-code.error';
import { MfaNotConfiguredError } from '../../../domain/errors/mfa-not-configured.error';
import type { DisableMfaPort } from '../../../ports/in/auth/disable-mfa.port';
import type { SecretCipherPort } from '../../../ports/out/secret-cipher.port';
import type { TotpPort } from '../../../ports/out/totp.port';
import {
  SECRET_CIPHER,
  TOTP,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';

export interface DisableMfaInput {
  userId: string;
  code: string;
}

/**
 * Desactivar exige un codigo TOTP vigente: si alguien roba una sesion abierta
 * (el accessToken) no puede apagar el segundo factor sin tener tambien el
 * celular. Borra todo el material MFA para que un setup posterior arranque limpio.
 */
@Injectable()
export class DisableMfaUseCase implements DisableMfaPort {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOTP) private readonly totp: TotpPort,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
  ) {}

  async execute(input: DisableMfaInput): Promise<void> {
    const credentials = await this.users.findMfaCredentials(input.userId);
    if (!credentials?.enabled || !credentials.totpSecretEnc) {
      throw new MfaNotConfiguredError();
    }

    const step = this.totp.verify(
      this.cipher.decrypt(credentials.totpSecretEnc),
      input.code.trim(),
    );
    if (
      step === null ||
      (credentials.lastStep !== null && step <= credentials.lastStep)
    ) {
      throw new InvalidMfaCodeError();
    }

    await this.users.updateMfa(input.userId, {
      enabled: false,
      totpSecretEnc: null,
      lastStep: null,
      backupCodeHashes: [],
    });
  }
}
