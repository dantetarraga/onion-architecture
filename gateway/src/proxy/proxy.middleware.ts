import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Todo lo que no es auth (branches/reservations/parking/payments/admin +
 * el WebSocket de /realtime) sigue siendo HTTP puro hacia `backend`: no hay
 * razon para convertir esas rutas a gRPC, el gateway solo necesita
 * reenviarlas tal cual, incluyendo el `Authorization` header sin tocarlo
 * (backend vuelve a verificar el mismo JWT de forma independiente).
 *
 * No podemos decidir esto por ORDEN de registro en Express: el router interno
 * de Nest, cuando ninguna ruta matchea, responde su propio 404 en vez de
 * llamar a `next()`, asi que una vez que Nest "atiende" el request ya no hay
 * forma de que caiga al proxy despues. Por eso el filtro es por PATH, antes
 * de que el request le llegue a Nest: si es una ruta que vive en este
 * gateway (auth/*, GET users/me) se deja pasar con `next()`; todo lo demas
 * se reenvia directo a `backend` sin pasar por el router de Nest.
 */
function isGatewayOwnedRoute(req: Request): boolean {
  if (req.path.startsWith('/auth')) {
    return true;
  }
  return req.path === '/users/me' && req.method === 'GET';
}

export function createBackendProxy() {
  const target = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3001';
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
  });

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (isGatewayOwnedRoute(req)) {
      return next();
    }
    return proxy(req, res, next);
  };
  middleware.upgrade = proxy.upgrade;
  return middleware;
}
