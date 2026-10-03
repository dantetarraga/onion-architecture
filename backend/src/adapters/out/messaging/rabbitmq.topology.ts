import type { Channel } from 'amqplib';

export interface RabbitMqTopologyNames {
  reservationsExchange: string;
  reservationsQueue: string;
  reservationsRoutingKey: string;
  deadLetterExchange: string;
  deadLetterQueue: string;
  deadLetterRoutingKey: string;
  realtimeExchange: string;
}

export function resolveTopologyNames(
  get: (key: string) => string | undefined,
): RabbitMqTopologyNames {
  const reservationsExchange =
    get('RABBITMQ_RESERVATIONS_EXCHANGE') ?? 'reservations';

  return {
    reservationsExchange,
    reservationsQueue:
      get('RABBITMQ_RESERVATIONS_QUEUE') ?? 'reservations.requests',
    reservationsRoutingKey: 'reservation.requested',
    deadLetterExchange: `${reservationsExchange}.dlx`,
    deadLetterQueue: `${reservationsExchange}.dlq`,
    deadLetterRoutingKey: 'reservation.requested.failed',
    realtimeExchange: get('RABBITMQ_REALTIME_EXCHANGE') ?? 'realtime.events',
  };
}

export async function assertTopology(
  channel: Channel,
  names: RabbitMqTopologyNames,
): Promise<void> {
  await channel.assertExchange(names.reservationsExchange, 'topic', {
    durable: true,
  });
  await channel.assertExchange(names.deadLetterExchange, 'topic', {
    durable: true,
  });

  await channel.assertQueue(names.deadLetterQueue, { durable: true });
  await channel.bindQueue(names.deadLetterQueue, names.deadLetterExchange, '#');

  await channel.assertQueue(names.reservationsQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': names.deadLetterExchange,
      'x-dead-letter-routing-key': names.deadLetterRoutingKey,
    },
  });
  await channel.bindQueue(
    names.reservationsQueue,
    names.reservationsExchange,
    names.reservationsRoutingKey,
  );

  await channel.assertExchange(names.realtimeExchange, 'fanout', {
    durable: true,
  });
}
