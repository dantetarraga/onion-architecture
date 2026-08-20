import { Global, Module } from '@nestjs/common';
import { NOTIFICATION_PUBLISHER } from '../core/ports/out/tokens';
import { KafkaNotificationPublisherAdapter } from '../adapters/out/messaging/kafka-notification-publisher.adapter';

@Global()
@Module({
  providers: [
    {
      provide: NOTIFICATION_PUBLISHER,
      useClass: KafkaNotificationPublisherAdapter,
    },
  ],
  exports: [NOTIFICATION_PUBLISHER],
})
export class MessagingModule {}
