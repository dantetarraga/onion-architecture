import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthGrpcModule } from './auth-grpc.module';
import { CoreInfraModule } from './core-infra.module';
import { MessagingModule } from './messaging.module';
import { PoliciesModule } from './policies.module';
import { RepositoriesModule } from './repositories.module';
import { ReservationsModule } from './reservations.module';
import { PrismaModule } from '../adapters/out/persistence/prisma/prisma.module';
import { ReservationRequestConsumer } from '../adapters/in/messaging/reservation-request.consumer';
import { RabbitRealtimeRelayAdapter } from '../adapters/out/messaging/rabbit-realtime-relay.adapter';
import { REALTIME_NOTIFIER } from '../core/ports/out/tokens';

/**
 * En el worker no hay sockets conectados (socket.io vive en el API), asi
 * que el mismo puerto `REALTIME_NOTIFIER` se resuelve al relay por
 * RabbitMQ. El nucleo no se entera: `CreateReservationUseCase` inyecta el
 * puerto, no el adaptador.
 */
@Global()
@Module({
  providers: [{ provide: REALTIME_NOTIFIER, useClass: RabbitRealtimeRelayAdapter }],
  exports: [REALTIME_NOTIFIER],
})
class WorkerRealtimeModule {}

/**
 * Ensamblado del proceso worker: mismos casos de uso, mismas politicas,
 * misma persistencia y mismo publisher de Kafka que el API, pero sin HTTP,
 * sin WebSocket y sin el scheduler de expiracion (ese sigue corriendo una
 * sola vez, en el API, para no duplicar el barrido).
 *
 * Lo unico que se enchufa de mas es el consumidor de la cola, que cumple
 * el mismo papel que un controller: disparar el nucleo desde afuera.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RepositoriesModule,
    PoliciesModule,
    CoreInfraModule,
    AuthGrpcModule,
    WorkerRealtimeModule,
    MessagingModule,
    ReservationsModule,
  ],
  providers: [ReservationRequestConsumer],
})
export class WorkerModule {}
