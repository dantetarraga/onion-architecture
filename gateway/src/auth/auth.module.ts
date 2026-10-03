import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { Rs256PublicKeyVerifier } from '../common/rs256-public-key-verifier';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthGrpcClient } from './auth-grpc.client';
import { AUTH_GRPC_CLIENT } from './auth-grpc.tokens';
import { UsersController } from './users.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    ClientsModule.registerAsync([
      {
        name: AUTH_GRPC_CLIENT,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'parking.auth.v1',
            protoPath: join(process.cwd(), 'proto', 'auth.proto'),
            url: config.get<string>('AUTH_SERVICE_GRPC_URL') ?? 'localhost:50051',
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthGrpcClient, Rs256PublicKeyVerifier, JwtAuthGuard],
  exports: [Rs256PublicKeyVerifier, JwtAuthGuard],
})
export class AuthModule {}
