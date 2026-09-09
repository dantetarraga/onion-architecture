import 'dotenv/config';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:29092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'notifications-service',
    topic:
      process.env.KAFKA_NOTIFICATIONS_TOPIC ??
      'notifications.email.confirmation',
    // Grupo de consumidor propio: si mas adelante hay otro consumidor del
    // mismo topico (ej. analytics), cada uno debe usar su propio grupo para
    // recibir todos los mensajes de forma independiente.
    groupId: process.env.KAFKA_CONSUMER_GROUP ?? 'notifications-service',
  },
  mail: {
    // Interruptor de seguridad: en false, el servicio consume y loguea el
    // correo que "hubiera mandado" sin llamar al SMTP real. Util para correr
    // el consumidor sin arriesgar enviar correos de prueba a bandejas reales.
    enabled: parseBool(process.env.MAIL_ENABLED, false),
    host: process.env.MAIL_HOST ?? 'mail.motoya.com.pe',
    port: parseIntEnv(process.env.MAIL_PORT, 465),
    username: process.env.MAIL_USERNAME ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    fromEmail:
      process.env.MAIL_FROM_EMAIL ??
      process.env.MAIL_USERNAME ??
      'notificaciones@motoya.com.pe',
  },
};

export type AppConfig = typeof config;
