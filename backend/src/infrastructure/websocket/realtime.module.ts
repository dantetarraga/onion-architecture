import { Global, Module } from '@nestjs/common';
import { REALTIME_NOTIFIER } from '../../application/ports/tokens';
import { EventsGateway } from './events.gateway';
import { RealtimeNotifierAdapter } from './realtime-notifier.adapter';

@Global()
@Module({
  providers: [EventsGateway, { provide: REALTIME_NOTIFIER, useClass: RealtimeNotifierAdapter }],
  exports: [REALTIME_NOTIFIER, EventsGateway],
})
export class RealtimeModule {}
