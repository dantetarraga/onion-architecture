import { Kafka } from 'kafkajs';
import { config } from './config';
import { AuditStore } from './store';
import { isAuditEvent } from './types';

export async function startConsumer(store: AuditStore): Promise<() => Promise<void>> {
  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    retry: { retries: 8 },
  });
  const consumer = kafka.consumer({ groupId: config.kafka.groupId });

  await consumer.connect();
  await consumer.subscribe({ topic: config.kafka.topic, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value?.toString('utf-8');
      if (!raw) throw new Error('Evento de auditoria sin contenido.');

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error('[audit-service] Evento JSON invalido; se descarta.');
        return;
      }
      if (!isAuditEvent(parsed)) {
        console.error('[audit-service] Evento con contrato invalido; se descarta.');
        return;
      }

      await store.append(parsed);
      console.log(`[audit-service] ${parsed.eventType} guardado (${parsed.eventId})`);
    },
  });

  console.log(
    `[audit-service] Escuchando ${config.kafka.topic} en ${config.kafka.brokers.join(', ')}`,
  );
  return () => consumer.disconnect();
}