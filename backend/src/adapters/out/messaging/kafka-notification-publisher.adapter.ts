import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import type {
  NotificationPublisherPort,
  ReservationConfirmationEvent,
} from '../../../core/ports/out/notification-publisher.port';

/**
 * Adaptador OUT: implementa `NotificationPublisherPort` publicando en un
 * topico de Kafka. El consumidor real (el servicio de notificaciones que
 * envia el correo) vive fuera de este backend; aqui solo se garantiza que
 * el mensaje llega a la cola con la info necesaria para redactar el correo.
 *
 * Resiliencia deliberada: si Kafka no esta disponible (broker caido, no
 * levantado en desarrollo local, etc.), el adaptador loguea y sigue sin
 * lanzar. Confirmar una reserva es la operacion critica del negocio;
 * notificar por correo es un efecto secundario que no debe poder tumbar el
 * flujo principal (mismo criterio que ya se aplica en
 * `RealtimeNotifierAdapter`, que tampoco bloquea la reserva si el socket
 * falla).
 */
@Injectable()
export class KafkaNotificationPublisherAdapter
  implements NotificationPublisherPort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaNotificationPublisherAdapter.name);
  private readonly producer: Producer;
  private readonly topic: string;
  private connected = false;

  constructor(private readonly config: ConfigService) {
    const brokers = (
      this.config.get<string>('KAFKA_BROKERS') ?? 'localhost:29092'
    )
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);
    this.topic =
      this.config.get<string>('KAFKA_NOTIFICATIONS_TOPIC') ??
      'notifications.email.confirmation';

    const kafka = new Kafka({
      clientId:
        this.config.get<string>('KAFKA_CLIENT_ID') ?? 'smart-parking-backend',
      brokers,
      retry: { retries: 3 },
      logCreator: () => () => {},
    });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log(
        `Conectado a Kafka, publicando confirmaciones en "${this.topic}"`,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo conectar a Kafka al iniciar (se reintentara en el primer publish): ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
    }
  }

  async publishReservationConfirmation(
    event: ReservationConfirmationEvent,
  ): Promise<void> {
    try {
      if (!this.connected) {
        await this.producer.connect();
        this.connected = true;
      }
      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.reservationId,
            value: JSON.stringify(event),
            headers: { eventType: event.eventType },
          },
        ],
      });
    } catch (error) {
      this.logger.error(
        `No se pudo publicar la confirmacion de la reserva ${event.reservationId} en Kafka: ${(error as Error).message}`,
      );
    }
  }
}
