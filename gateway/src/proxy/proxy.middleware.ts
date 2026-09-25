import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Todo lo que no es auth se reenvia por HTTP, sin tocarlo (incluido el
 * `Authorization` header: cada servicio vuelve a verificar el mismo JWT de
 * forma independiente), al servicio dueño de la ruta:
 *
 * - realtime-service: `/socket.io/*` (polling HTTP y upgrade a WebSocket del
 *   namespace /realtime).
 * - payments-service: `POST /payments`, `GET /payments/:id`,
 *   `GET /users/me/payments`.
 * - backend: todo lo demas (branches/reservations/parking/admin/users/me/*).
 *
 * Las URLs publicas son las mismas que exponia el monolito: el frontend no
 * cambia. `GET /parking/sessions/:id/amount` se queda en backend a proposito:
 * la tarifa (PricingPolicy) sigue alli, junto a las sucursales.
 *
 * No podemos decidir esto por ORDEN de registro en Express: el router interno
 * de Nest, cuando ninguna ruta matchea, responde su propio 404 en vez de
 * llamar a `next()`, asi que una vez que Nest "atiende" el request ya no hay
 * forma de que caiga al proxy despues. Por eso el filtro es por PATH, antes
 * de que el request le llegue a Nest: si es una ruta que vive en este
 * gateway (auth/*, GET users/me) se deja pasar con `next()`; todo lo demas
 * se reenvia directo a su upstream sin pasar por el router de Nest.
 */
function isGatewayOwnedRoute(req: Request): boolean {
  if (req.path.startsWith('/auth')) {
    return true;
  }
  return req.path === '/users/me' && req.method === 'GET';
}

function isRealtimeRoute(path: string): boolean {
  return path === '/socket.io' || path.startsWith('/socket.io/');
}

function isPaymentsRoute(req: Request): boolean {
  if (req.path === '/payments' || req.path.startsWith('/payments/')) {
    return true;
  }
  return req.path === '/users/me/payments' && req.method === 'GET';
}

export function createServicesProxy() {
  const backend = createProxyMiddleware({
    target: process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3001',
    changeOrigin: true,
  });
  const payments = createProxyMiddleware({
    target: process.env.PAYMENTS_INTERNAL_URL ?? 'http://localhost:3020',
    changeOrigin: true,
  });
  // Sin `ws: true`: el upgrade se engancha a mano en main.ts (ver `upgrade`
  // abajo). Con `ws: true` http-proxy-middleware ademas se suscribiria solo al
  // evento `upgrade` del server y el WebSocket se manejaria dos veces.
  const realtime = createProxyMiddleware({
    target: process.env.REALTIME_INTERNAL_URL ?? 'http://localhost:3030',
    changeOrigin: true,
  });

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (isGatewayOwnedRoute(req)) {
      return next();
    }
    if (isRealtimeRoute(req.path)) {
      return realtime(req, res, next);
    }
    if (isPaymentsRoute(req)) {
      return payments(req, res, next);
    }
    return backend(req, res, next);
  };

  /** Solo realtime-service habla WebSocket; cualquier otro upgrade se corta. */
  middleware.upgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? '/', 'http://gateway').pathname;
    if (isRealtimeRoute(path)) {
      realtime.upgrade(req, socket as never, head);
      return;
    }
    socket.destroy();
  };

  return middleware;
}
