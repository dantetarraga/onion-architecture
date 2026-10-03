import { Role } from '../../domain/enums/role.enum';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Subconjunto de solo-verificacion del TokenPort que hoy vive en auth-service
 * (dueño de la clave privada RS256 y de sign()/signMfaChallenge()). backend
 * solo necesita comprobar la firma con la clave publica: defensa en
 * profundidad, ya que gateway ya valido el mismo token antes de reenviar la
 * request. RolesGuard/@CurrentUser()/todos los controladores de negocio no
 * cambian: siguen viendo el mismo AuthTokenPayload de siempre.
 */
export interface PublicKeyVerifierPort {
  verify(token: string): Promise<AuthTokenPayload>;
}
