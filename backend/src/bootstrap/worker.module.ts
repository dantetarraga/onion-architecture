import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthGrpcModule } from './auth-grpc.module';
import { PaymentsGrpcModule } from './payments-grpc.module';
import { CoreInfraModule } from './core-infra.module';
import { MessagingModule } from './messaging.module';
import { PoliciesModule } from './policies.module';
import { RealtimeModule } from './realtime.module';
import { RepositoriesModule } from './repositories.module';
import { ReservationsModule } from './reservations.module';
import { PrismaModule } from '../adapters/out/persistence/prisma/prisma.module';
import { ReservationRequestConsumer } from '../adapters/in/messaging/reservation-request.consumer';

/**
 * Ensamblado del proceso worker: mismos casos de uso, mismas politicas,
 * misma persistencia, mismo publisher de Kafka y mismo publicador de tiempo
 * real (RabbitMQ -> realtime-service) que el API, pero sin HTTP, sin gRPC
 * entrante y sin el scheduler de expiracion (ese sigue corriendo una sola
 * vez, en el API, para no duplicar el barrido).
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
    PaymentsGrpcModule,
    RealtimeModule,
    MessagingModule,
    ReservationsModule,
  ],
  providers: [ReservationRequestConsumer],
})
export class WorkerModule {}
