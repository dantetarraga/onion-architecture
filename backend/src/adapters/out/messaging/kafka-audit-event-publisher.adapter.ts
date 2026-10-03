import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Producer } from 'kafkajs';
import type { AuditEvent, AuditEventPublisherPort } from '../../../core/ports/out/audit-event-publisher.port';

@Injectable()
export class KafkaAuditEventPublisherAdapter
  implements AuditEventPublisherPort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaAuditEventPublisherAdapter.name);
  private readonly producer: Producer;
  private readonly topic: string;
  private connected = false;

  constructor(config: ConfigService) {
    const brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:29092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);
    this.topic = config.get<string>('KAFKA_AUDIT_TOPIC') ?? 'business.audit.events';
    const kafka = new Kafka({
      clientId: `${config.get<string>('KAFKA_CLIENT_ID') ?? 'smart-parking-backend'}-audit`,
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
      this.logger.log(`Publicando eventos de auditoria en "${this.topic}"`);
    } catch (error) {
      this.logger.warn(`Kafka de auditoria no disponible al iniciar: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.producer.disconnect();
  }

  async publishAuditEvent(event: AuditEvent): Promise<void> {
    try {
      if (!this.connected) {
        await this.producer.connect();
        this.connected = true;
      }
      await this.producer.send({
        topic: this.topic,
        messages: [{
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: { eventType: event.eventType },
        }],
      });
    } catch (error) {
      this.logger.warn(`No se pudo publicar ${event.eventType}: ${(error as Error).message}`);
    }
  }
}