import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { RealtimeNotifierPort } from '../../../core/ports/out/realtime-notifier.port';
import { REALTIME_NOTIFIER } from '../../../core/ports/out/tokens';
import type { RealtimeRelayEnvelope } from '../../out/messaging/rabbit-realtime-relay.adapter';
import { RabbitMqConnection } from '../../out/messaging/rabbitmq.connection';

/**
 * Adaptador IN del proceso API: recibe los eventos de tiempo real que el
 * worker no pudo emitir (no tiene sockets) y los reemite con el adaptador
 * de socket.io real.
 *
 * La cola es exclusiva y auto-delete: cada instancia del API tiene la
 * suya, de modo que el fanout le entrega una copia a todas y cada una
 * atiende a los navegadores conectados a ella. Si el API se apaga, su cola
 * desaparece sola en vez de acumular eventos que ya nadie va a ver.
 */
@Injectable()
export class RealtimeRelayConsumer implements OnModuleInit {
  private readonly logger = new Logger(RealtimeRelayConsumer.name);

  constructor(
    private readonly connection: RabbitMqConnection,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  onModuleInit(): void {
    this.connection.onReady(async (channel) => this.subscribe(channel));
  }

  private async subscribe(channel: ConfirmChannel): Promise<void> {
    const exchange = this.connection.topology.realtimeExchange;

    const { queue } = await channel.assertQueue('', {
      exclusive: true,
      autoDelete: true,
      durable: false,
    });
    await channel.bindQueue(queue, exchange, '');
    await channel.consume(queue, (message) => this.handle(channel, message), {
      noAck: true,
    });

    this.logger.log(`Reemitiendo eventos de "${exchange}" hacia socket.io`);
  }

  private handle(channel: ConfirmChannel, message: ConsumeMessage | null): void {
    if (!message) {
      return;
    }

    try {
      const { method, args } = JSON.parse(
        message.content.toString(),
      ) as RealtimeRelayEnvelope;

      const handler = this.notifier[method];
      if (typeof handler !== 'function') {
        this.logger.warn(`Evento de tiempo real desconocido: "${String(method)}"`);
        return;
      }

      (handler as (...params: unknown[]) => void).apply(this.notifier, args);
    } catch (error) {
      this.logger.error(
        `No se pudo reemitir un evento de tiempo real: ${(error as Error).message}`,
      );
    }
  }
}
