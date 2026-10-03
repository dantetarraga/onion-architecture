import { Role } from '../../domain/enums/role.enum';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Solo-verificacion del token RS256 que firma auth-service (dueño de la clave
 * privada). payments-service comprueba la firma con la clave publica, igual
 * que gateway y backend: defensa en profundidad, gateway ya valido el mismo
 * token antes de reenviar la request.
 */
export interface PublicKeyVerifierPort {
  verify(token: string): Promise<AuthTokenPayload>;
}
