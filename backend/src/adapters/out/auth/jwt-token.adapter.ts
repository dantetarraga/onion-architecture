import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, SignJWT } from 'jose';
import {
  AuthTokenPayload,
  TokenPort,
} from '../../../core/ports/out/token.port';
import { Role } from '../../../core/domain/enums/role.enum';

/**
 * Claim `purpose` que distingue los dos tokens que firma este adaptador con
 * la misma clave: el access token normal y el desafio MFA. Sin esta marca, un
 * mfaToken robado serviria para llamar a la API como si fuera un login completo.
 */
const PURPOSE_ACCESS = 'access';
const PURPOSE_MFA = 'mfa';

@Injectable()
export class JwtTokenAdapter implements TokenPort {
  private readonly secret: Uint8Array;
  private readonly expiresIn: string;
  private readonly mfaChallengeExpiresIn: string;

  constructor(private readonly config: ConfigService) {
    this.secret = new TextEncoder().encode(
      this.config.get<string>('JWT_SECRET') ?? 'dev-secret',
    );
    this.expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h';
    this.mfaChallengeExpiresIn =
      this.config.get<string>('MFA_CHALLENGE_EXPIRES_IN') ?? '5m';
  }

  async sign(payload: AuthTokenPayload): Promise<string> {
    return new SignJWT({
      email: payload.email,
      role: payload.role,
      purpose: PURPOSE_ACCESS,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AuthTokenPayload> {
    const { payload } = await jwtVerify(token, this.secret);
    // Tokens emitidos antes de esta version no traen `purpose`: se aceptan.
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
      .sign(this.secret);
  }

  async verifyMfaChallenge(token: string): Promise<{ sub: string }> {
    const { payload } = await jwtVerify(token, this.secret);
    if (payload.purpose !== PURPOSE_MFA || typeof payload.sub !== 'string') {
      throw new Error('El token no es un desafio MFA.');
    }
    return { sub: payload.sub };
  }
}
