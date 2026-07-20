import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import type { AuthTokenPayload, TokenPort } from '../../../application/ports/token.port';
import { TOKEN_SERVICE } from '../../../application/ports/tokens';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort) {}

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
