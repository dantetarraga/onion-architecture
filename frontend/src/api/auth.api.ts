import { api } from '@/lib/axios';
import type { AuthUser } from '@/types/entities';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Todos los logins (password, Google, Facebook) responden lo mismo: la sesion
 * completa, o —si el usuario activo la verificacion en dos pasos— un token
 * intermedio que solo sirve para POST /auth/mfa/verify.
 */
export type LoginResult =
  | { mfaRequired: false; accessToken: string; user: AuthUser }
  | { mfaRequired: true; mfaToken: string };

export interface MfaSetupResult {
  secret: string;
  otpauthUri: string;
}

export interface MfaConfirmResult {
  backupCodes: string[];
}

export const authApi = {
  login: (input: LoginInput) => api.post<LoginResult>('/auth/login', input).then((r) => r.data),
  register: (input: RegisterInput) => api.post<AuthUser>('/auth/register', input).then((r) => r.data),
  /** Login/registro con Google: idToken emitido por Firebase Authentication en el cliente. */
  loginWithGoogle: (idToken: string) =>
    api.post<LoginResult>('/auth/google', { idToken }).then((r) => r.data),
  loginWithFacebook: (accessToken: string) =>
    api.post<LoginResult>('/auth/facebook', { accessToken }).then((r) => r.data),

  // --- MFA (Google Authenticator / cualquier app TOTP) ---
  /** Segundo factor: canjea el mfaToken + codigo (TOTP o de respaldo) por la sesion completa. */
  verifyMfa: (mfaToken: string, code: string) =>
    api.post<LoginResult>('/auth/mfa/verify', { mfaToken, code }).then((r) => r.data),
  setupMfa: () => api.post<MfaSetupResult>('/auth/mfa/setup').then((r) => r.data),
  confirmMfa: (code: string) => api.post<MfaConfirmResult>('/auth/mfa/confirm', { code }).then((r) => r.data),
  disableMfa: (code: string) => api.delete<void>('/auth/mfa', { data: { code } }).then((r) => r.data),
};
