import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthTokenPayload } from '../common/auth-token-payload';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthGrpcClient } from './auth-grpc.client';
import { callAuthRpc } from './grpc-error.util';

/**
 * Solo `GET /me` vive aqui (necesita datos reales de User, que ahora vive en
 * auth-service). `/me/reservations`, `/me/sessions` y `/me/payments` son
 * negocio de `backend` y llegan por el proxy HTTP generico (ver
 * src/proxy/proxy.middleware.ts), sin pasar por este controller.
 *
 * Nota de paridad deliberada: el `GET /users/me` de antes de la extraccion
 * devolvia la entidad `User` completa sin mapear a DTO, filtrando
 * `passwordHash`/`createdAt` en el JSON (el frontend los ignoraba porque su
 * tipo TS no los declara, pero SI viajaban por la red). Aqui se devuelve solo
 * lo que el tipo `AuthUser` del frontend declara — es una correccion
 * deliberada del leak, no una regresion.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly authGrpc: AuthGrpcClient) {}

  @Get('me')
  async me(@CurrentUser() user: AuthTokenPayload) {
    const reply = await callAuthRpc(
      this.authGrpc.auth.getUserById({ userId: user.sub }),
    );
    return {
      id: reply.id,
      email: reply.email,
      fullName: reply.fullName,
      role: reply.role,
      mfaEnabled: reply.mfaEnabled,
    };
  }
}
