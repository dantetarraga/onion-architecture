import { join } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthServiceGrpcAdapter } from '../adapters/out/auth/auth-service-grpc.adapter';
import { AUTH_GRPC_CLIENT, USER_LOOKUP } from '../core/ports/out/tokens';

/**
 * Cliente gRPC de backend hacia auth-service. Unico uso legitimo (no es
 * validacion de token por request, que se queda local via JwtAuthGuard):
 * CreateReservationUseCase necesita email/fullName reales para el evento de
 * confirmacion de reserva por correo (Kafka).
 */
@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: AUTH_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: 'parking.auth.v1',
          protoPath: join(process.cwd(), 'proto', 'auth.proto'),
          url: process.env.AUTH_SERVICE_GRPC_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  providers: [
    { provide: USER_LOOKUP, useClass: AuthServiceGrpcAdapter },
  ],
  exports: [USER_LOOKUP],
})
export class AuthGrpcModule {}
