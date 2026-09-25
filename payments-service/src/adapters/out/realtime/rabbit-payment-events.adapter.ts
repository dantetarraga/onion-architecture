import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import * as amqp from 'amqplib';
import type { PaymentEventsPort } from '../../../core/ports/out/payment-events.port';

/**
 * Mismo contrato que publica backend (ver
 * realtime-service/src/types.ts, `RealtimeEventEnvelope`): realtime-service no
 * sabe de pagos ni de reservas, solo reenvia `event` + `payload` a la sala
 * que indica `target`.
 */
interface RealtimeEventEnvelope {
  event: string;
  target: { type: 'admin' };
  payload: unknown;
}

/**
 * Publica los pagos registrados en el exchange fanout de tiempo real. Si
 * RabbitMQ no esta disponible el pago NO falla (igual que en el monolito,
 * notificar el dashboard era fire-and-forget): solo se loguea.
 */
@Injectable()
export class RabbitPaymentEventsAdapter implements PaymentEventsPort, OnModuleDestroy {
  private readonly logger = new Logger(RabbitPaymentEventsAdapter.name);
  private readonly url: string;
  private readonly exchange: string;
  private model: ChannelModel | null = null;
  private channel: Promise<ConfirmChannel> | null = null;

  constructor(config: ConfigService) {
    this.url = config.get<string>('RABBITMQ_URL') ?? 'amqp://parking:parking@localhost:5672';
    this.exchange = config.get<string>('RABBITMQ_REALTIME_EXCHANGE') ?? 'realtime.events';
  }

  paymentRegistered(payload: {
    paymentId: string;
    sessionId: string;
    branchId: string;
    amount: number;
    status: string;
  }): void {
    this.publish({ event: 'payment.registered', target: { type: 'admin' }, payload });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.model?.close();
    } catch {
      // ya cerrada
    }
  }

  private publish(envelope: RealtimeEventEnvelope): void {
    void this.getChannel()
      .then((channel) => {
        channel.publish(this.exchange, '', Buffer.from(JSON.stringify(envelope)), {
          contentType: 'application/json',
        });
      })
      .catch((error: Error) => {
        this.channel = null;
        this.logger.error(
          `No se pudo publicar "${envelope.event}" en tiempo real: ${error.message}`,
        );
      });
  }

  private getChannel(): Promise<ConfirmChannel> {
    if (!this.channel) {
      this.channel = this.open();
    }
    return this.channel;
  }

  private async open(): Promise<ConfirmChannel> {
    const model = await amqp.connect(this.url);
    const channel = await model.createConfirmChannel();
    await channel.assertExchange(this.exchange, 'fanout', { durable: true });

    // Al caerse la conexion se descarta el canal: el proximo publish reconecta.
    const reset = () => {
      this.model = null;
      this.channel = null;
    };
    model.on('close', reset);
    model.on('error', (error: Error) => {
      this.logger.error(`Error de conexion con RabbitMQ: ${error.message}`);
    });

    this.model = model;
    return channel;
  }
}
