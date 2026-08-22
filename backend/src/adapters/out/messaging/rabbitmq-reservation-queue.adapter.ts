import { Injectable, Logger } from '@nestjs/common';
import type {
  ReservationRequestMessage,
  ReservationRequestQueuePort,
} from '../../../core/ports/out/reservation-request-queue.port';
import { RabbitMqConnection } from './rabbitmq.connection';

@Injectable()
export class RabbitMqReservationQueueAdapter implements ReservationRequestQueuePort {
  private readonly logger = new Logger(RabbitMqReservationQueueAdapter.name);

  constructor(private readonly connection: RabbitMqConnection) {}

  async enqueue(message: ReservationRequestMessage): Promise<void> {
    const { reservationsExchange, reservationsRoutingKey } =
      this.connection.topology;

    try {
      const channel = await this.connection.getChannel();

      await new Promise<void>((resolve, reject) => {
        channel.publish(
          reservationsExchange,
          reservationsRoutingKey,
          Buffer.from(JSON.stringify(message)),
          {
            persistent: true,
            messageId: message.requestId,
            contentType: 'application/json',
            timestamp: message.requestedAt.getTime(),
          },
          (error) => (error ? reject(error) : resolve()),
        );
      });

      this.logger.log(
        `Solicitud de reserva ${message.requestId} encolada en "${reservationsExchange}" (${reservationsRoutingKey})`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo encolar la solicitud de reserva ${message.requestId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
