import { config } from './config';
import { startConsumer } from './consumer';

async function main(): Promise<void> {
  console.log(
    `[notifications-service] Iniciando. MAIL_ENABLED=${config.mail.enabled} MAIL_HOST=${config.mail.host}:${config.mail.port}`,
  );

  const stopConsumer = await startConsumer();

  const shutdown = async (signal: string) => {
    console.log(`[notifications-service] Recibido ${signal}, cerrando...`);
    await stopConsumer();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[notifications-service] Error fatal al iniciar:', error);
  process.exit(1);
});
