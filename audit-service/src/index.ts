import { config } from './config';
import { startConsumer } from './consumer';
import { startHttpServer } from './http';
import { AuditStore } from './store';

async function main(): Promise<void> {
  const store = new AuditStore(config.databaseUrl);
  await store.initialize();
  const server = await startHttpServer(store);
  const stopConsumer = await startConsumer(store);

  const shutdown = async (signal: string) => {
    console.log(`[audit-service] Recibido ${signal}, cerrando...`);
    await stopConsumer();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await store.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[audit-service] Error fatal al iniciar:', error);
  process.exit(1);
});