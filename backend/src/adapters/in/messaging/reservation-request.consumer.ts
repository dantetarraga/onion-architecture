import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { ProcessReservationRequestPort } from '../../../core/ports/in/reservations/process-reservation-request.port';
import { PROCESS_RESERVATION_REQUEST } from '../../../core/ports/in/tokens';
import type { ReservationRequestMessage } from '../../../core/ports/out/reservation-request-queue.port';
import { RabbitMqConnection } from '../../out/messaging/rabbitmq.connection';

/**
 * Adaptador IN: consume la cola de trabajo y dispara el nucleo, igual que
 * un controller HTTP o el `ReservationExpirationScheduler`. Lo unico que
 * cambia es quien golpea la puerta: aqui es RabbitMQ.
 *
 * Solo se registra en el proceso worker (`WorkerModule`).
 */
@Injectable()
export class ReservationRequestConsumer implements OnModuleInit {
  private readonly logger = new Logger(ReservationRequestConsumer.name);
  private readonly prefetch: number;

  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly config: ConfigService,
    @Inject(PROCESS_RESERVATION_REQUEST)
    private readonly processRequest: ProcessReservationRequestPort,
  ) {
    this.prefetch = Number(this.config.get<string>('RABBITMQ_PREFETCH') ?? 1);
  }

  onModuleInit(): void {
    this.connection.onReady(async (channel) => this.subscribe(channel));
  }

  private async subscribe(channel: ConfirmChannel): Promise<void> {
    const queue = this.connection.topology.reservationsQueue;

    // Con prefetch 1 el broker no entrega un mensaje nuevo hasta que se
    // ack-ea el anterior: las solicitudes se procesan de a una, lo que
    // elimina la carrera de dos usuarios reclamando la misma cochera y
    // hace visible la cola en la UI durante la demo.
    await channel.prefetch(this.prefetch);
    await channel.consume(queue, (message) => {
      void this.handle(channel, message);
    });

    this.logger.log(
      `Consumiendo "${queue}" con prefetch=${this.prefetch}`,
    );
  }

  private async handle(
    channel: ConfirmChannel,
    message: ConsumeMessage | null,
  ): Promise<void> {
    if (!message) {
      return;
    }

    let payload: ReservationRequestMessage;
    try {
      payload = this.parse(message.content);
    } catch (error) {
      this.logger.error(
        `Mensaje ilegible descartado a la DLQ: ${(error as Error).message}`,
      );
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.processRequest.execute(payload);
      channel.ack(message);
      this.logger.log(`Solicitud ${payload.requestId} procesada`);
    } catch (error) {
      // Los rechazos de negocio ya los absorbio el caso de uso; llegar aqui
      // significa fallo de infraestructura, asi que el mensaje va a la DLQ
      // en vez de reintentarse en bucle.
      this.logger.error(
        `Solicitud ${payload.requestId} fallo, enviada a la DLQ: ${(error as Error).message}`,
      );
      channel.nack(message, false, false);
    }
  }

  /** El JSON aplana las fechas a string; el nucleo espera `Date`. */
  private parse(content: Buffer): ReservationRequestMessage {
    const raw = JSON.parse(content.toString()) as ReservationRequestMessage;

    if (!raw.requestId || !raw.userId || !raw.branchId) {
      throw new Error('faltan campos obligatorios en el mensaje');
    }

    return {
      ...raw,
      startAt: raw.startAt ? new Date(raw.startAt) : undefined,
      requestedAt: new Date(raw.requestedAt),
    };
  }
}
