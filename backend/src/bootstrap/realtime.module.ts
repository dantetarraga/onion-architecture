import { Global, Module } from '@nestjs/common';
import { REALTIME_NOTIFIER } from '../core/ports/out/tokens';
import { EventsGateway } from '../adapters/in/websocket/events.gateway';
import { RealtimeNotifierAdapter } from '../adapters/out/realtime/realtime-notifier.adapter';

@Global()
@Module({
  providers: [EventsGateway, { provide: REALTIME_NOTIFIER, useClass: RealtimeNotifierAdapter }],
  exports: [REALTIME_NOTIFIER, EventsGateway],
})
export class RealtimeModule {}
