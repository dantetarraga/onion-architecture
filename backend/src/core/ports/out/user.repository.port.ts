import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
}

/**
 * Material MFA del usuario. Vive aparte de la entidad User a proposito: la
 * entidad se serializa en respuestas HTTP (GET /users/me) y el secreto TOTP,
 * aunque cifrado, no tiene por que salir nunca del backend.
 */
export interface MfaCredentials {
  enabled: boolean;
  totpSecretEnc: string | null;
  lastStep: number | null;
  backupCodeHashes: string[];
}

export type MfaCredentialsPatch = Partial<MfaCredentials>;

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  findMfaCredentials(userId: string): Promise<MfaCredentials | null>;
  updateMfa(userId: string, patch: MfaCredentialsPatch): Promise<void>;
}
