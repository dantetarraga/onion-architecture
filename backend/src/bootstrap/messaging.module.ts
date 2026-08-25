import { Global, Module } from '@nestjs/common';
import {
  NOTIFICATION_PUBLISHER,
  RESERVATION_REQUEST_QUEUE,
} from '../core/ports/out/tokens';
import { KafkaNotificationPublisherAdapter } from '../adapters/out/messaging/kafka-notification-publisher.adapter';
import { RabbitMqReservationQueueAdapter } from '../adapters/out/messaging/rabbitmq-reservation-queue.adapter';
import { RabbitMqConnection } from '../adapters/out/messaging/rabbitmq.connection';

/**
 * Los dos brokers, cada uno en su rol:
 *
 * - Kafka (`NOTIFICATION_PUBLISHER`): bus de eventos de salida. Publica la
 *   confirmacion de reserva para que un servicio externo mande el correo.
 * - RabbitMQ (`RESERVATION_REQUEST_QUEUE`): cola de trabajo. Absorbe las
 *   solicitudes de reserva para que las procese el worker.
 */
@Global()
@Module({
  providers: [
    RabbitMqConnection,
    {
      provide: NOTIFICATION_PUBLISHER,
      useClass: KafkaNotificationPublisherAdapter,
    },
    {
      provide: RESERVATION_REQUEST_QUEUE,
      useClass: RabbitMqReservationQueueAdapter,
    },
  ],
  exports: [RabbitMqConnection, NOTIFICATION_PUBLISHER, RESERVATION_REQUEST_QUEUE],
})
export class MessagingModule {}
