import { createServer, type Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { upstreamFor } from '../proxy/proxy.middleware';

/**
 * Metricas Prometheus del proceso. Un registry propio (no el global de
 * prom-client) con la etiqueta `service`, asi los paneles de Grafana
 * distinguen servicios.
 */
export const registry = new Registry();
registry.setDefaultLabels({
  service: process.env.SERVICE_NAME ?? 'gateway',
});
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_server_request_duration_seconds',
  help: 'Duracion de los requests HTTP atendidos, por ruta, upstream y codigo de estado.',
  labelNames: ['method', 'route', 'upstream', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * Middleware Express, registrado ANTES del proxy: mide tanto las rutas
 * propias del gateway (`upstream="gateway"`, route = patron de Nest) como lo
 * que se reenvia (`upstream` = servicio destino). En lo reenviado el gateway
 * no conoce el patron de la ruta, asi que `route` queda como `proxy` para no
 * crear una serie por cada URL; el detalle por ruta lo tiene cada upstream.
 */
export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const end = httpRequestDuration.startTimer();
  const upstream = upstreamFor(req);
  res.on('finish', () => {
    let route = 'proxy';
    if (upstream === 'gateway') {
      route = req.route?.path
        ? `${req.baseUrl ?? ''}${req.route.path as string}`
        : 'unmatched';
    }
    end({
      method: req.method,
      route,
      upstream,
      status_code: String(res.statusCode),
    });
  });
  next();
}

/**
 * Sirve GET /metrics en un puerto interno propio (METRICS_PORT, 9464 por
 * defecto): el :3000 es publico y /metrics no debe verse desde afuera.
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
