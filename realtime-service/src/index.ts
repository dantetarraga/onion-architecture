import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createTokenVerifier } from './auth';
import { config } from './config';
import { startRelay } from './relay';
import type { AuthenticatedUser } from './types';

async function main(): Promise<void> {
  const verify = await createTokenVerifier(config.jwtPublicKey);

  // Health check para docker/gateway; todo lo demas lo atiende socket.io
  // (path por defecto /socket.io, que gateway reenvia tal cual).
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });
  const nsp = io.of(config.namespace);

  // Mismas reglas que el EventsGateway del monolito: sin token valido no hay
  // conexion; cada usuario entra a su sala `user:<id>` (ahi llega el
  // resultado de SU solicitud de reserva) y los admins ademas a `admin`.
  nsp.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Token de autenticacion faltante.'));
      return;
    }
    try {
      socket.data.user = await verify(token);
      next();
    } catch {
      console.warn(`[realtime-service] conexion rechazada: token invalido (${socket.id})`);
      next(new Error('Token de autenticacion invalido.'));
    }
  });

  nsp.on('connection', (socket) => {
    const user = socket.data.user as AuthenticatedUser;
    void socket.join(`user:${user.sub}`);
    if (user.role === 'ADMIN') {
      void socket.join('admin');
    }

    socket.on('join:branch', (data: { branchId?: string }) => {
      if (data?.branchId) void socket.join(`branch:${data.branchId}`);
    });
    socket.on('leave:branch', (data: { branchId?: string }) => {
      if (data?.branchId) void socket.leave(`branch:${data.branchId}`);
    });
  });

  const stopRelay = await startRelay(nsp);

  httpServer.listen(config.port, () => {
    console.log(`[realtime-service] socket.io escuchando en :${config.port}${config.namespace}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[realtime-service] Recibido ${signal}, cerrando...`);
    await stopRelay();
    io.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[realtime-service] Error fatal al iniciar:', error);
  process.exit(1);
});
