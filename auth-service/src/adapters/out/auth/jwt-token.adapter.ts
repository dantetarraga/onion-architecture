import { createHash } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import {
  AuthTokenPayload,
  TokenPort,
} from '../../../core/ports/out/token.port';
import { Role } from '../../../core/domain/enums/role.enum';

/**
 * Claim `purpose` que distingue los dos tokens que firma este adaptador: el
 * access token (RS256, verificable por cualquier servicio con la clave
 * publica de auth-service) y el desafio MFA (HS256, secreto interno: nunca
 * sale de auth-service, solo lo emite y lo vuelve a verificar VerifyMfaUseCase
 * en el mismo proceso, asi que no necesita ser asimetrico).
 */
const PURPOSE_ACCESS = 'access';
const PURPOSE_MFA = 'mfa';
const RS256_ALG = 'RS256';

/** `.env` suele guardar un PEM multilinea como un solo string con "\n" literales; jose necesita saltos de linea reales. */
function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

@Injectable()
export class JwtTokenAdapter implements TokenPort, OnModuleInit {
  private privateKey!: CryptoKey;
  private publicKey!: CryptoKey;
  private readonly mfaSecret: Uint8Array;
  private readonly expiresIn: string;
  private readonly mfaChallengeExpiresIn: string;

  constructor(private readonly config: ConfigService) {
    this.expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h';
    this.mfaChallengeExpiresIn =
      this.config.get<string>('MFA_CHALLENGE_EXPIRES_IN') ?? '5m';
    // El secreto del desafio MFA se deriva de la clave privada: no requiere
    // gestionar un tercer secreto para algo que jamas cruza el proceso.
    const privatePem = this.config.get<string>('JWT_PRIVATE_KEY') ?? '';
    this.mfaSecret = createHash('sha256').update(privatePem).digest();
  }

  async onModuleInit(): Promise<void> {
    const privatePem = this.config.get<string>('JWT_PRIVATE_KEY');
    const publicPem = this.config.get<string>('JWT_PUBLIC_KEY');
    if (!privatePem || !publicPem) {
      throw new Error(
        'JWT_PRIVATE_KEY / JWT_PUBLIC_KEY no configurados: requeridos para firmar/verificar sesiones (RS256).',
      );
    }
    this.privateKey = await importPKCS8(normalizePem(privatePem), RS256_ALG);
    this.publicKey = await importSPKI(normalizePem(publicPem), RS256_ALG);
  }

  async sign(payload: AuthTokenPayload): Promise<string> {
    return new SignJWT({
      email: payload.email,
      role: payload.role,
      purpose: PURPOSE_ACCESS,
    })
      .setProtectedHeader({ alg: RS256_ALG })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.privateKey);
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

  async signMfaChallenge(userId: string): Promise<string> {
    return new SignJWT({ purpose: PURPOSE_MFA })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(this.mfaChallengeExpiresIn)
      .sign(this.mfaSecret);
  }

  async verifyMfaChallenge(token: string): Promise<{ sub: string }> {
    const { payload } = await jwtVerify(token, this.mfaSecret);
    if (payload.purpose !== PURPOSE_MFA || typeof payload.sub !== 'string') {
      throw new Error('El token no es un desafio MFA.');
    }
    return { sub: payload.sub };
  }
}
