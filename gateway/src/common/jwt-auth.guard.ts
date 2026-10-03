import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthTokenPayload } from './auth-token-payload';
import { Rs256PublicKeyVerifier } from './rs256-public-key-verifier';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: Rs256PublicKeyVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthTokenPayload }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticacion faltante.');
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      request.user = await this.tokenService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token de autenticacion invalido.');
    }
  }
}
