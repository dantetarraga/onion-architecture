import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthTokenPayload } from '../../../application/ports/token.port';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthTokenPayload => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthTokenPayload }>();
  return request.user;
});
