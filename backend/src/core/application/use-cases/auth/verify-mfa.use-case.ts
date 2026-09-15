import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../../../domain/errors/invalid-credentials.error';
import { InvalidMfaCodeError } from '../../../domain/errors/invalid-mfa-code.error';
import type { VerifyMfaPort } from '../../../ports/in/auth/verify-mfa.port';
import type { PasswordHasherPort } from '../../../ports/out/password-hasher.port';
import type { SecretCipherPort } from '../../../ports/out/secret-cipher.port';
import type { TokenPort } from '../../../ports/out/token.port';
import type { TotpPort } from '../../../ports/out/totp.port';
import {
  PASSWORD_HASHER,
  SECRET_CIPHER,
  TOKEN_SERVICE,
  TOTP,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import type {
  MfaCredentials,
  UserRepositoryPort,
} from '../../../ports/out/user.repository.port';
import { normalizeBackupCode } from './confirm-mfa.use-case';
import { issueAccessSession, type LoginUserResult } from './issue-session';

export interface VerifyMfaInput {
  /** Token intermedio devuelto por el login cuando mfaRequired = true. */
  mfaToken: string;
  /** Codigo TOTP de 6 digitos o un codigo de respaldo `XXXX-XXXX`. */
  code: string;
}

/**
 * Segundo factor del login. Acepta el codigo de la app (camino normal) o un
 * codigo de respaldo (camino de emergencia). En ambos casos el codigo se
 * "consume": el TOTP guardando el step usado, el de respaldo borrando su hash.
 */
@Injectable()
export class VerifyMfaUseCase implements VerifyMfaPort {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOTP) private readonly totp: TotpPort,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort,
  ) {}

  async execute(input: VerifyMfaInput): Promise<LoginUserResult> {
    let userId: string;
    try {
      userId = (await this.tokenService.verifyMfaChallenge(input.mfaToken)).sub;
    } catch {
      throw new InvalidCredentialsError(
        'El desafio MFA expiro. Vuelve a iniciar sesion.',
      );
    }

    const [user, credentials] = await Promise.all([
      this.users.findById(userId),
      this.users.findMfaCredentials(userId),
    ]);
    if (!user || !credentials?.enabled || !credentials.totpSecretEnc) {
      throw new InvalidCredentialsError();
    }

    const code = input.code.trim();
    const accepted = /^\d{6}$/.test(code)
      ? await this.consumeTotp(userId, credentials, code)
      : await this.consumeBackupCode(userId, credentials, code);
    if (!accepted) {
      throw new InvalidMfaCodeError();
    }

    return issueAccessSession(this.tokenService, user);
  }

  private async consumeTotp(
    userId: string,
    credentials: MfaCredentials,
    code: string,
  ): Promise<boolean> {
    const step = this.totp.verify(
      this.cipher.decrypt(credentials.totpSecretEnc!),
      code,
    );
    // Anti-replay: un codigo vale 30 s (+-30 de tolerancia); si alguien lo
    // intercepta y lo reenvia dentro de esa ventana, el step ya quedo usado.
    if (
      step === null ||
      (credentials.lastStep !== null && step <= credentials.lastStep)
    ) {
      return false;
    }
    await this.users.updateMfa(userId, { lastStep: step });
    return true;
  }

  private async consumeBackupCode(
    userId: string,
    credentials: MfaCredentials,
    raw: string,
  ): Promise<boolean> {
    const code = normalizeBackupCode(raw);
    for (const [index, hash] of credentials.backupCodeHashes.entries()) {
      if (await this.hasher.compare(code, hash)) {
        const remaining = credentials.backupCodeHashes.filter(
          (_, i) => i !== index,
        );
        await this.users.updateMfa(userId, { backupCodeHashes: remaining });
        return true;
      }
    }
    return false;
  }
}
