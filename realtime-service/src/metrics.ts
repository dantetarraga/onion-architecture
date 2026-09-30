import { createServer, type Server } from 'node:http';
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';

/**
 * Metricas Prometheus del proceso, en un puerto aparte (METRICS_PORT) igual
 * que el resto de servicios. Con `--scale realtime-service=N` Prometheus
 * descubre cada replica por DNS y cada una reporta sus propios sockets.
 */
export const registry = new Registry();
registry.setDefaultLabels({
  service: process.env.SERVICE_NAME ?? 'realtime-service',
});
collectDefaultMetrics({ register: registry });

export const connectedSockets = new Gauge({
  name: 'realtime_connected_sockets',
  help: 'Sockets conectados ahora mismo al namespace /realtime.',
  registers: [registry],
});

export const connectionAttempts = new Counter({
  name: 'realtime_connection_attempts_total',
  help: 'Handshakes al namespace /realtime, por resultado (accepted, missing_token, invalid_token).',
  labelNames: ['result'] as const,
  registers: [registry],
});

export const eventsRelayed = new Counter({
  name: 'realtime_events_relayed_total',
  help: 'Eventos de realtime.events reemitidos por socket.io, por evento y tipo de destino.',
  labelNames: ['event', 'target'] as const,
  registers: [registry],
});

export const eventsDropped = new Counter({
  name: 'realtime_events_dropped_total',
  help: 'Mensajes de realtime.events descartados (ilegibles, sin event/target o target desconocido).',
  registers: [registry],
});

export const rabbitConnected = new Gauge({
  name: 'realtime_rabbitmq_connected',
  help: '1 si la instancia esta consumiendo realtime.events, 0 si esta reconectando.',
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
    console.log(`[realtime-service] metricas en :${port}/metrics`);
  });
  return server;
}
