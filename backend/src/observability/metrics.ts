import { createServer, type Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import type { CircuitState } from '../adapters/out/resilience/circuit-breaker';

/**
 * Metricas Prometheus del proceso. Un registry propio (no el global de
 * prom-client) con la etiqueta `service`, asi los paneles de Grafana
 * distinguen servicios aunque compartan codigo (backend y reservations-worker
 * son el mismo build: SERVICE_NAME los separa).
 */
export const registry = new Registry();
registry.setDefaultLabels({
  service: process.env.SERVICE_NAME ?? 'backend',
});
collectDefaultMetrics({ register: registry });

const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export const httpRequestDuration = new Histogram({
  name: 'http_server_request_duration_seconds',
  help: 'Duracion de los requests HTTP atendidos, por ruta y codigo de estado.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const grpcServerDuration = new Histogram({
  name: 'grpc_server_handling_seconds',
  help: 'Duracion de las llamadas gRPC atendidas, por metodo y resultado.',
  labelNames: ['grpc_method', 'grpc_status'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const reservationRequestsProcessed = new Counter({
  name: 'reservation_requests_processed_total',
  help: 'Solicitudes de reserva consumidas de RabbitMQ por el worker, por desenlace.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

/**
 * Middleware Express: mide cada request al terminar. La etiqueta `route` usa
 * el patron de Nest (`/reservations/:id`), nunca la URL cruda, para no crear
 * una serie por cada id; lo que no matchea ninguna ruta cae en `unmatched`.
 */
export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path
      ? `${req.baseUrl ?? ''}${req.route.path as string}`
      : 'unmatched';
    end({ method: req.method, route, status_code: String(res.statusCode) });
  });
  next();
}

/** Estado de cada circuit breaker hacia otro servicio: 0=CLOSED, 1=HALF_OPEN, 2=OPEN. */
export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Estado del circuit breaker por servicio destino (0=CLOSED, 1=HALF_OPEN, 2=OPEN).',
  labelNames: ['target'] as const,
  registers: [registry],
});

export const circuitBreakerRejections = new Counter({
  name: 'circuit_breaker_rejections_total',
  help: 'Llamadas rechazadas sin tocar la red porque el circuito estaba abierto.',
  labelNames: ['target'] as const,
  registers: [registry],
});

const STATE_VALUE: Record<CircuitState, number> = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };

/** Hooks para CircuitBreaker: publica cada cambio de estado y cada rechazo. */
export const circuitBreakerMetrics = {
  onStateChange: (target: string, state: CircuitState) =>
    circuitBreakerState.set({ target }, STATE_VALUE[state]),
  onReject: (target: string) => circuitBreakerRejections.inc({ target }),
};

/**
 * Sirve GET /metrics en un puerto interno propio (METRICS_PORT, 9464 por
 * defecto) en vez de en el puerto de la API: no queda expuesto a traves del
 * gateway y funciona igual en procesos sin HTTP (reservations-worker).
 */
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
  server.listen(port);
  return server;
}
