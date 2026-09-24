import { User } from '../../../domain/entities/user.entity';
import type { TokenPort } from '../../../ports/out/token.port';

export interface AuthenticatedUserSummary {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/**
 * Resultado comun de todos los logins (password, Google, Facebook). Si el
 * usuario tiene MFA activo, el primer factor NO entrega un accessToken: entrega
 * un mfaToken de corta vida que solo sirve para POST /auth/mfa/verify.
 */
export type LoginUserResult =
  | { mfaRequired: false; accessToken: string; user: AuthenticatedUserSummary }
  | { mfaRequired: true; mfaToken: string };

/**
 * Cierre compartido de los casos de uso de login: una vez validado el primer
 * factor, decide si emite la sesion completa o el desafio MFA. Centralizarlo
 * aqui evita que cada proveedor (password, Google, Facebook) tenga que
 * recordar la regla; agregar un proveedor nuevo hereda el MFA sin codigo extra.
 */
export async function issueSession(
  tokenService: TokenPort,
  user: User,
): Promise<LoginUserResult> {
  if (user.mfaEnabled) {
    return {
      mfaRequired: true,
      mfaToken: await tokenService.signMfaChallenge(user.id),
    };
  }
  return issueAccessSession(tokenService, user);
}

/** Emite la sesion completa sin consultar MFA: la usa VerifyMfaUseCase tras validar el segundo factor. */
export async function issueAccessSession(
  tokenService: TokenPort,
  user: User,
): Promise<LoginUserResult> {
  const accessToken = await tokenService.sign({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  return {
    mfaRequired: false,
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}
