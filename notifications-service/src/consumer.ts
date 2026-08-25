import { Kafka, EachMessagePayload } from 'kafkajs';
import { config } from './config';
import { sendConfirmationEmail } from './mailer';
import { isReservationConfirmationEvent } from './types';

const MAX_SEND_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reintenta el envio del correo unas pocas veces (fallo transitorio de SMTP)
 * antes de darse por vencido. Un fallo definitivo se loguea y el mensaje se
 * da por procesado igual: sin outbox/dead-letter en este alcance, reintentar
 * indefinidamente bloquearia el consumo del resto del topico.
 */
async function processMessage(payload: EachMessagePayload): Promise<void> {
  const raw = payload.message.value?.toString('utf-8');
  if (!raw) {
    console.warn('[consumer] Mensaje sin valor, se ignora.');
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(
      `[consumer] Mensaje no es JSON valido, se descarta: ${(error as Error).message}`,
    );
    return;
  }

  if (!isReservationConfirmationEvent(parsed)) {
    console.warn(
      '[consumer] Mensaje no tiene la forma de ReservationConfirmationEvent, se ignora.',
      parsed,
    );
    return;
  }

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      await sendConfirmationEmail(parsed);
      console.log(
        `[consumer] Correo de confirmacion procesado para reserva ${parsed.reservationId} (${parsed.userEmail})`,
      );
      return;
    } catch (error) {
      const isLastAttempt = attempt === MAX_SEND_ATTEMPTS;
      console.error(
        `[consumer] Fallo al enviar correo para reserva ${parsed.reservationId} (intento ${attempt}/${MAX_SEND_ATTEMPTS}): ${(error as Error).message}`,
      );
      if (isLastAttempt) {
        console.error(
          `[consumer] Se agotaron los reintentos para reserva ${parsed.reservationId}. Correo NO enviado.`,
        );
        return;
      }
      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }
}

export async function startConsumer(): Promise<() => Promise<void>> {
  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    retry: { retries: 8 },
  });

  const consumer = kafka.consumer({ groupId: config.kafka.groupId });

  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafka.topic,
    fromBeginning: false,
  });

  console.log(
    `[consumer] Conectado a Kafka (${config.kafka.brokers.join(', ')}), escuchando "${config.kafka.topic}" (grupo "${config.kafka.groupId}")`,
  );

  await consumer.run({
    eachMessage: async (payload) => {
      await processMessage(payload);
    },
  });

  return async () => {
    await consumer.disconnect();
  };
}
