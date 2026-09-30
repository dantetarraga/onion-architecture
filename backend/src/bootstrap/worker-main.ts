import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { startMetricsServer } from '../observability/metrics';

/**
 * Entrypoint del worker de reservas. Es un contexto de aplicacion Nest sin
 * servidor HTTP: solo inyeccion de dependencias y el consumidor de la cola
 * escuchando `reservations.requests`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  // Sin HTTP propio: /metrics se sirve en su puerto aparte (METRICS_PORT).
  startMetricsServer();

  Logger.log(
    'Worker de reservas iniciado, esperando solicitudes en RabbitMQ',
    'ReservationsWorker',
  );
}
void bootstrap();
