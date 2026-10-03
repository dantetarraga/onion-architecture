import 'dotenv/config';

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : fallback;
}

/** `.env` suele guardar un PEM multilinea como un solo string con "\n" literales; jose necesita saltos de linea reales. */
function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

export const config = {
  port: parseIntEnv(process.env.PORT, 3030),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Mismo namespace que tenia el EventsGateway del monolito: el frontend
  // conecta a `${VITE_WS_URL}/realtime` y no cambia.
  namespace: '/realtime',
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://parking:parking@localhost:5672',
    exchange: process.env.RABBITMQ_REALTIME_EXCHANGE ?? 'realtime.events',
    reconnectDelayMs: 3000,
  },
  // Solo la clave publica: verifica localmente el mismo JWT RS256 que firma
  // auth-service, igual que gateway/backend/payments-service.
  jwtPublicKey: normalizePem(process.env.JWT_PUBLIC_KEY ?? ''),
};

export type AppConfig = typeof config;
