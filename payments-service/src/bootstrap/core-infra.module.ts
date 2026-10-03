import { join } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Rs256PublicKeyVerifierAdapter } from '../adapters/out/auth/rs256-public-key-verifier.adapter';
import { SystemClockAdapter } from '../adapters/out/clock/system-clock.adapter';
import { ParkingGrpcAdapter } from '../adapters/out/parking/parking-grpc.adapter';
import { CardPaymentAdapter } from '../adapters/out/payments/card-payment.adapter';
import { CashPaymentAdapter } from '../adapters/out/payments/cash-payment.adapter';
import { PaymentMethodRouterAdapter } from '../adapters/out/payments/payment-method-router.adapter';
import { PlinPaymentAdapter } from '../adapters/out/payments/plin-payment.adapter';
import { YapePaymentAdapter } from '../adapters/out/payments/yape-payment.adapter';
import { PrismaPaymentRepository } from '../adapters/out/persistence/prisma/repositories/prisma-payment.repository';
import { RabbitPaymentEventsAdapter } from '../adapters/out/realtime/rabbit-payment-events.adapter';
import { KafkaAuditEventPublisherAdapter } from '../adapters/out/messaging/kafka-audit-event-publisher.adapter';
import {
  AUDIT_EVENT_PUBLISHER,
  CLOCK,
  PARKING_GRPC_CLIENT,
  PAYMENT_EVENTS,
  PAYMENT_METHOD,
  PAYMENT_REPOSITORY,
  PUBLIC_KEY_VERIFIER,
  SESSION_BILLING,
} from '../core/ports/out/tokens';

/** Todos los adaptadores OUT del servicio, resueltos contra sus puertos. */
@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: PARKING_GRPC_CLIENT,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'parking.core.v1',
            protoPath: join(process.cwd(), 'proto', 'parking.proto'),
            url: config.get<string>('PARKING_SERVICE_GRPC_URL') ?? 'localhost:50053',
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [
    { provide: AUDIT_EVENT_PUBLISHER, useClass: KafkaAuditEventPublisherAdapter },
    { provide: CLOCK, useClass: SystemClockAdapter },
    { provide: PUBLIC_KEY_VERIFIER, useClass: Rs256PublicKeyVerifierAdapter },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: SESSION_BILLING, useClass: ParkingGrpcAdapter },
    { provide: PAYMENT_EVENTS, useClass: RabbitPaymentEventsAdapter },
    CashPaymentAdapter,
    CardPaymentAdapter,
    YapePaymentAdapter,
    PlinPaymentAdapter,
    { provide: PAYMENT_METHOD, useClass: PaymentMethodRouterAdapter },
  ],
  exports: [
    AUDIT_EVENT_PUBLISHER,
    CLOCK,
    PUBLIC_KEY_VERIFIER,
    PAYMENT_REPOSITORY,
    SESSION_BILLING,
    PAYMENT_EVENTS,
    PAYMENT_METHOD,
  ],
})
export class CoreInfraModule {}
