import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import {
  AuthTokenPayload,
  PublicKeyVerifierPort,
} from '../../../core/ports/out/token.port';
import { Role } from '../../../core/domain/enums/role.enum';

const RS256_ALG = 'RS256';
const PURPOSE_ACCESS = 'access';

/** `.env` suele guardar un PEM multilinea como un solo string con "\n" literales; jose necesita saltos de linea reales. */
function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

/**
 * Verifica localmente (sin llamar a auth-service) los access tokens RS256
 * que este firma con su clave privada. Es el mismo verify-only que hace
 * `gateway`: backend queda usable/testeable de forma standalone (defensa en
 * profundidad), sin depender de una llamada de red por cada request.
 */
@Injectable()
export class Rs256PublicKeyVerifierAdapter
  implements PublicKeyVerifierPort, OnModuleInit
{
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
