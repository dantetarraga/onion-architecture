import { createServer, type Server } from 'node:http';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/**
 * Metricas Prometheus del proceso. Este servicio no tiene HTTP propio: solo
 * consume Kafka, asi que /metrics se sirve en un puerto aparte (METRICS_PORT).
 */
export const registry = new Registry();
registry.setDefaultLabels({
  service: process.env.SERVICE_NAME ?? 'notifications-service',
});
collectDefaultMetrics({ register: registry });

/**
 * Desenlace de cada mensaje del topico: `sent` (SMTP ok), `skipped`
 * (MAIL_ENABLED=false, solo se loguea), `failed` (se agotaron los reintentos)
 * o `invalid` (mensaje vacio, no-JSON o sin la forma del evento).
 */
export const notificationMessages = new Counter({
  name: 'notification_messages_total',
  help: 'Mensajes de confirmacion consumidos de Kafka, por desenlace.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const emailSendAttempts = new Counter({
  name: 'notification_email_send_attempts_total',
  help: 'Intentos de envio de correo (incluye reintentos), por resultado.',
  labelNames: ['result'] as const,
  registers: [registry],
});

export const messageProcessingDuration = new Histogram({
  name: 'notification_message_processing_seconds',
  help: 'Tiempo total de procesar un mensaje, reintentos incluidos.',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

export function startMetricsServer(
  port = Number(process.env.METRICS_PORT ?? 9464),
): Server {
  const server = createServer((req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404);
      res.end();
      return;
    }
    registry
      .metrics()
      .then((body) => {
        res.writeHead(200, { 'Content-Type': registry.contentType });
        res.end(body);
      })
      .catch((error: Error) => {
        res.writeHead(500);
        res.end(error.message);
      });
  });
  server.listen(port, () => {
    console.log(`[notifications-service] metricas en :${port}/metrics`);
  });
  return server;
}
