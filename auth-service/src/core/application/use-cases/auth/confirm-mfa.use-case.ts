import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { InvalidMfaCodeError } from '../../../domain/errors/invalid-mfa-code.error';
import { MfaAlreadyEnabledError } from '../../../domain/errors/mfa-already-enabled.error';
import { MfaNotConfiguredError } from '../../../domain/errors/mfa-not-configured.error';
import type { ConfirmMfaPort } from '../../../ports/in/auth/confirm-mfa.port';
import type { PasswordHasherPort } from '../../../ports/out/password-hasher.port';
import type { SecretCipherPort } from '../../../ports/out/secret-cipher.port';
import type { TotpPort } from '../../../ports/out/totp.port';
import {
  PASSWORD_HASHER,
  SECRET_CIPHER,
  TOTP,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';

export interface ConfirmMfaInput {
  userId: string;
  code: string;
}

export interface ConfirmMfaResult {
  /** Codigos de respaldo en claro. Se muestran UNA sola vez; en la DB solo queda su hash. */
  backupCodes: string[];
}

const BACKUP_CODES_COUNT = 8;
/** Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para que se puedan dictar o anotar a mano. */
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Paso 2 de la activacion: el primer codigo correcto demuestra que la app del
 * usuario quedo bien configurada. Solo entonces se enciende mfaEnabled y se
 * generan los codigos de respaldo (por si pierde el celular).
 */
@Injectable()
export class ConfirmMfaUseCase implements ConfirmMfaPort {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOTP) private readonly totp: TotpPort,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(input: ConfirmMfaInput): Promise<ConfirmMfaResult> {
    const credentials = await this.users.findMfaCredentials(input.userId);
    if (!credentials?.totpSecretEnc) {
      throw new MfaNotConfiguredError('Primero genera el codigo QR (setup).');
    }
    if (credentials.enabled) {
      throw new MfaAlreadyEnabledError();
    }

    const step = this.totp.verify(
      this.cipher.decrypt(credentials.totpSecretEnc),
      input.code,
    );
    if (step === null) {
      throw new InvalidMfaCodeError();
    }

    const backupCodes = Array.from(
      { length: BACKUP_CODES_COUNT },
      generateBackupCode,
    );
    const backupCodeHashes = await Promise.all(
      backupCodes.map((code) => this.hasher.hash(code)),
    );

    await this.users.updateMfa(input.userId, {
      enabled: true,
      lastStep: step,
      backupCodeHashes,
    });

    return { backupCodes };
  }
}

/** Formato `XXXX-XXXX`: 8 simbolos de un alfabeto de 31 = ~40 bits de entropia por codigo. */
export function generateBackupCode(): string {
  const pick = () =>
    BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `${block()}-${block()}`;
}

/** Normaliza lo que teclea el usuario: mayusculas, sin espacios ni guiones, y lo vuelve a formatear. */
export function normalizeBackupCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length === 8
    ? `${clean.slice(0, 4)}-${clean.slice(4)}`
    : raw.trim().toUpperCase();
}
