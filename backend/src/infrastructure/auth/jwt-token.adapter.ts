import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, SignJWT } from 'jose';
import { AuthTokenPayload, TokenPort } from '../../application/ports/token.port';
import { Role } from '../../domain/enums/role.enum';

@Injectable()
export class JwtTokenAdapter implements TokenPort {
  private readonly secret: Uint8Array;
  private readonly expiresIn: string;

  constructor(private readonly config: ConfigService) {
    this.secret = new TextEncoder().encode(this.config.get<string>('JWT_SECRET') ?? 'dev-secret');
    this.expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h';
  }

  async sign(payload: AuthTokenPayload): Promise<string> {
    return new SignJWT({ email: payload.email, role: payload.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AuthTokenPayload> {
    const { payload } = await jwtVerify(token, this.secret);
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  }
}
