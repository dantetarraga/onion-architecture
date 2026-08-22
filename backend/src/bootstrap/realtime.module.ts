import { Global, Module } from '@nestjs/common';
import { REALTIME_NOTIFIER } from '../core/ports/out/tokens';
import { RealtimeRelayConsumer } from '../adapters/in/messaging/realtime-relay.consumer';
import { EventsGateway } from '../adapters/in/websocket/events.gateway';
import { RealtimeNotifierAdapter } from '../adapters/out/realtime/realtime-notifier.adapter';

/**
 * Tiempo real del proceso API: el gateway socket.io, el adaptador que
 * implementa el puerto emitiendo por socket, y el consumidor que reemite
 * los eventos que el worker mando por RabbitMQ (ver `WorkerModule`, donde
 * el mismo puerto se resuelve al relay en vez de al socket).
 */
@Global()
@Module({
  providers: [
    EventsGateway,
    { provide: REALTIME_NOTIFIER, useClass: RealtimeNotifierAdapter },
    RealtimeRelayConsumer,
  ],
  exports: [REALTIME_NOTIFIER, EventsGateway],
})
export class RealtimeModule {}
