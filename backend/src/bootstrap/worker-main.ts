import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Entrypoint del worker de reservas. Es un contexto de aplicacion Nest sin
 * servidor HTTP: solo inyeccion de dependencias y el consumidor de la cola
 * escuchando `reservations.requests`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  Logger.log(
    'Worker de reservas iniciado, esperando solicitudes en RabbitMQ',
    'ReservationsWorker',
  );
}
void bootstrap();
