import { Global, Module } from '@nestjs/common';
import { REALTIME_NOTIFIER } from '../core/ports/out/tokens';
import { RabbitRealtimePublisherAdapter } from '../adapters/out/realtime/rabbit-realtime-publisher.adapter';

/**
 * Tiempo real de backend (API y worker por igual): el puerto se resuelve al
 * publicador de RabbitMQ. Los sockets viven en realtime-service, que consume
 * el exchange `realtime.events` y emite a los navegadores. Requiere
 * MessagingModule (RabbitMqConnection) y RepositoriesModule (ocupacion).
 */
@Global()
@Module({
  providers: [{ provide: REALTIME_NOTIFIER, useClass: RabbitRealtimePublisherAdapter }],
  exports: [REALTIME_NOTIFIER],
})
export class RealtimeModule {}
