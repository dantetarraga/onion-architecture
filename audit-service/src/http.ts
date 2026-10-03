import { createServer, type IncomingMessage, type Server } from 'node:http';
import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { config } from './config';
import { AuditStore } from './store';

function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

async function createAdminVerifier(): Promise<(request: IncomingMessage) => Promise<boolean>> {
  const key: CryptoKey = await importSPKI(normalizePem(config.jwtPublicKey), 'RS256');
  return async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return false;
    try {
      const { payload } = await jwtVerify(header.slice(7), key);
      return payload.role === 'ADMIN' && (payload.purpose === undefined || payload.purpose === 'access');
    } catch {
      return false;
    }
  };
}

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export async function startHttpServer(store: AuditStore): Promise<Server> {
  const isAdmin = await createAdminVerifier();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://audit-service');
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }
    if (request.method !== 'GET' || url.pathname !== '/audit/events') {
      sendJson(response, 404, { message: 'Not found' });
      return;
    }
    if (!(await isAdmin(request))) {
      sendJson(response, 401, { message: 'Se requiere un token de administrador.' });
      return;
    }

    const requestedLimit = Number(url.searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
      : 50;
    const eventType = url.searchParams.get('eventType') ?? undefined;
    try {
      sendJson(response, 200, { items: await store.list(limit, eventType) });
    } catch (error) {
      console.error(`[audit-service] Error consultando eventos: ${(error as Error).message}`);
      sendJson(response, 500, { message: 'No se pudo consultar el historial.' });
    }
  });

  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  console.log(`[audit-service] API HTTP escuchando en :${config.port}`);
  return server;
}