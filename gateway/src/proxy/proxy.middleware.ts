import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Todo lo que no es auth (branches/reservations/parking/payments/admin +
 * el WebSocket de /realtime) sigue siendo HTTP puro hacia `backend`: no hay
 * razon para convertir esas rutas a gRPC, el gateway solo necesita
 * reenviarlas tal cual, incluyendo el `Authorization` header sin tocarlo
 * (backend vuelve a verificar el mismo JWT de forma independiente).
 */
export function createBackendProxy() {
  const target = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3001';
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
  });
}
