import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { AuthTokenPayload } from './auth-token-payload';
import { Role } from './role.enum';

const RS256_ALG = 'RS256';
const PURPOSE_ACCESS = 'access';

/** `.env` suele guardar un PEM multilinea como un solo string con "\n" literales; jose necesita saltos de linea reales. */
function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

/**
 * Verifica localmente los access tokens RS256 que auth-service firma con su
 * clave privada — el gateway nunca llama por red para validar un token, solo
 * para las operaciones reales de auth (login/register/mfa/etc, via gRPC).
 * Copia deliberada de backend/src/adapters/out/auth/rs256-public-key-verifier.adapter.ts:
 * gateway es un paquete Node separado, sin import compartido entre ambos.
 */
@Injectable()
export class Rs256PublicKeyVerifier implements OnModuleInit {
  private publicKey!: CryptoKey;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const publicPem = this.config.get<string>('JWT_PUBLIC_KEY');
    if (!publicPem) {
      throw new Error(
        'JWT_PUBLIC_KEY no configurado: requerido para verificar sesiones (RS256).',
      );
    }
    this.publicKey = await importSPKI(normalizePem(publicPem), RS256_ALG);
  }

  async verify(token: string): Promise<AuthTokenPayload> {
    const { payload } = await jwtVerify(token, this.publicKey);
    if (payload.purpose !== undefined && payload.purpose !== PURPOSE_ACCESS) {
      throw new Error('El token no es un access token.');
    }
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  }
}
