import * as amqp from 'amqplib';
import type { ChannelModel, ConsumeMessage } from 'amqplib';
import type { Namespace } from 'socket.io';
import { config } from './config';
import type { RealtimeEventEnvelope } from './types';

const ADMIN_ROOM = 'admin';

/**
 * Traduce el `target` del contrato a salas de socket.io, con las mismas
 * reglas que tenia el EventsGateway del monolito: lo de una sucursal lo ven
 * los suscritos a esa sucursal y los admins; lo de un usuario, ese usuario y
 * los admins; lo de admin, solo admins. Encadenar `.to()` hace la union de
 * salas: un admin suscrito tambien a la sucursal recibe el evento una vez.
 */
export function emitEnvelope(nsp: Namespace, envelope: RealtimeEventEnvelope): void {
  const { event, target, payload } = envelope;
  switch (target.type) {
    case 'branch':
      nsp.to(`branch:${target.branchId}`).to(ADMIN_ROOM).emit(event, payload);
      return;
    case 'user':
      nsp.to(`user:${target.userId}`).to(ADMIN_ROOM).emit(event, payload);
      return;
    case 'admin':
      nsp.to(ADMIN_ROOM).emit(event, payload);
      return;
    default:
      console.warn(`[realtime-service] target desconocido en "${event}":`, target);
  }
}

/**
 * Consume `realtime.events` y reemite cada mensaje por socket.io.
 *
 * La cola es exclusiva y auto-delete: cada instancia de realtime-service tiene
 * la suya, asi el fanout le entrega una copia a todas y cada una atiende a los
 * navegadores conectados a ella (escala horizontal sin adapter de Redis).
 * Si la instancia se apaga, su cola desaparece en vez de acumular eventos que
 * ya nadie va a ver. Reconecta sola si RabbitMQ se cae.
 */
export async function startRelay(nsp: Namespace): Promise<() => Promise<void>> {
  let model: ChannelModel | null = null;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const handle = (message: ConsumeMessage | null) => {
    if (!message) return;
    try {
      const envelope = JSON.parse(message.content.toString()) as RealtimeEventEnvelope;
      if (!envelope?.event || !envelope.target) {
        console.warn('[realtime-service] mensaje sin event/target, se descarta');
        return;
      }
      emitEnvelope(nsp, envelope);
    } catch (error) {
      console.error('[realtime-service] no se pudo reemitir un evento:', (error as Error).message);
    }
  };

  const scheduleReconnect = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, config.rabbitmq.reconnectDelayMs);
  };

  const connect = async (): Promise<void> => {
    try {
      const connection = await amqp.connect(config.rabbitmq.url);
      connection.on('error', (error: Error) => {
        console.error('[realtime-service] error de conexion con RabbitMQ:', error.message);
      });
      connection.on('close', () => {
        model = null;
        if (!stopped) {
          console.warn(
            `[realtime-service] conexion con RabbitMQ cerrada, reintentando en ${config.rabbitmq.reconnectDelayMs}ms`,
          );
          scheduleReconnect();
        }
      });

      const channel = await connection.createChannel();
      await channel.assertExchange(config.rabbitmq.exchange, 'fanout', { durable: true });
      const { queue } = await channel.assertQueue('', {
        exclusive: true,
        autoDelete: true,
        durable: false,
      });
      await channel.bindQueue(queue, config.rabbitmq.exchange, '');
      await channel.consume(queue, handle, { noAck: true });

      model = connection;
      console.log(`[realtime-service] reemitiendo "${config.rabbitmq.exchange}" hacia socket.io`);
    } catch (error) {
      console.warn(
        `[realtime-service] no se pudo conectar a RabbitMQ (se reintentara): ${(error as Error).message}`,
      );
      scheduleReconnect();
    }
  };

  await connect();

  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      await model?.close();
    } catch {
      // ya cerrada
    }
  };
}
