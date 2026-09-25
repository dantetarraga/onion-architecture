import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import type { AuthenticatedUser } from './types';

const RS256_ALG = 'RS256';
const PURPOSE_ACCESS = 'access';

export type TokenVerifier = (token: string) => Promise<AuthenticatedUser>;

/**
 * Verificador RS256 local (sin llamar a auth-service), copia deliberada del
 * que usan gateway/backend: cada servicio es un paquete separado. Rechaza el
 * token intermedio de MFA (`purpose: 'mfa'`): solo un access token abre socket.
 */
export async function createTokenVerifier(publicPem: string): Promise<TokenVerifier> {
  if (!publicPem) {
    throw new Error('JWT_PUBLIC_KEY no configurado: requerido para autenticar sockets (RS256).');
  }
  const publicKey: CryptoKey = await importSPKI(publicPem, RS256_ALG);

  return async (token: string) => {
    const { payload } = await jwtVerify(token, publicKey);
    if (payload.purpose !== undefined && payload.purpose !== PURPOSE_ACCESS) {
      throw new Error('El token no es un access token.');
    }
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as AuthenticatedUser['role'],
    };
  };
}
