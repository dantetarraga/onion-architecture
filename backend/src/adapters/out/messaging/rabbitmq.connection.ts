import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import * as amqp from 'amqplib';
import {
  assertTopology,
  resolveTopologyNames,
  type RabbitMqTopologyNames,
} from './rabbitmq.topology';

type ReadyHandler = (channel: ConfirmChannel) => Promise<void>;

const RECONNECT_DELAY_MS = 3000;

@Injectable()
export class RabbitMqConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnection.name);
  private readonly url: string;
  readonly topology: RabbitMqTopologyNames;

  private model: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connecting: Promise<ConfirmChannel> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;
  private readonly readyHandlers: ReadyHandler[] = [];

  constructor(private readonly config: ConfigService) {
    this.url =
      this.config.get<string>('RABBITMQ_URL') ??
      'amqp://parking:parking@localhost:5672';
    this.topology = resolveTopologyNames((key) => this.config.get<string>(key));
  }

  onModuleInit(): void {
    void this.connect().catch((error: Error) => {
      this.logger.warn(
        `No se pudo conectar a RabbitMQ al iniciar (se reintentara): ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.model?.close();
    } catch {
      // close connection
    }
    this.model = null;
    this.channel = null;
  }

  async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }
    return this.connect();
  }

  onReady(handler: ReadyHandler): void {
    this.readyHandlers.push(handler);
    if (this.channel) {
      void this.runHandler(handler, this.channel);
    }
  }

  private connect(): Promise<ConfirmChannel> {
    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.openChannel()
      .then(async (channel) => {
        this.channel = channel;
        this.logger.log(`Conectado a RabbitMQ (${this.safeUrl()})`);
        for (const handler of this.readyHandlers) {
          await this.runHandler(handler, channel);
        }
        return channel;
      })
      .finally(() => {
        this.connecting = null;
      });

    return this.connecting;
  }

  private async openChannel(): Promise<ConfirmChannel> {
    const model = await amqp.connect(this.url);
    const channel = await model.createConfirmChannel();

    await assertTopology(channel, this.topology);

    model.on('error', (error: Error) => {
      this.logger.error(`Error de conexion con RabbitMQ: ${error.message}`);
    });
    model.on('close', () => {
      this.model = null;
      this.channel = null;
      if (!this.shuttingDown) {
        this.logger.warn(
          `Conexion con RabbitMQ cerrada, reintentando en ${RECONNECT_DELAY_MS}ms`,
        );
        this.scheduleReconnect();
      }
    });
    channel.on('close', () => {
      this.channel = null;
    });
    channel.on('error', (error: Error) => {
      this.logger.error(`Error de canal AMQP: ${error.message}`);
    });

    this.model = model;
    return channel;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch((error: Error) => {
        this.logger.warn(`Reintento de conexion fallido: ${error.message}`);
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }

  private async runHandler(
    handler: ReadyHandler,
    channel: ConfirmChannel,
  ): Promise<void> {
    try {
      await handler(channel);
    } catch (error) {
      this.logger.error(
        `Fallo al inicializar un consumidor de RabbitMQ: ${(error as Error).message}`,
      );
    }
  }

  private safeUrl(): string {
    return this.url.replace(/\/\/[^@]*@/, '//***@');
  }
}
