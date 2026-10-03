import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no configurado.`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3040),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:29092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'audit-service',
    topic: process.env.KAFKA_AUDIT_TOPIC ?? 'business.audit.events',
    groupId: process.env.KAFKA_CONSUMER_GROUP ?? 'audit-service',
  },
  databaseUrl: required('DATABASE_URL'),
  jwtPublicKey: required('JWT_PUBLIC_KEY'),
};