import { Role } from '../../domain/enums/role.enum';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface TokenPort {
  sign(payload: AuthTokenPayload): Promise<string>;
  /** Verifica un access token. Debe rechazar tokens de desafio MFA aunque esten bien firmados. */
  verify(token: string): Promise<AuthTokenPayload>;
  /**
   * Token intermedio de corta vida que prueba "ya paso el primer factor"
   * (password / proveedor social) y solo sirve para POST /auth/mfa/verify.
   */
  signMfaChallenge(userId: string): Promise<string>;
  verifyMfaChallenge(token: string): Promise<{ sub: string }>;
}
