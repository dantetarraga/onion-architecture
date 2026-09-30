import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { httpMetricsMiddleware, startMetricsServer } from '../observability/metrics';
import { DomainExceptionFilter } from '../adapters/in/http/filters/domain-exception.filter';

/**
 * Dos entradas en el mismo proceso:
 * - HTTP (PORT): trafico del navegador que gateway enruta por path
 *   (POST /payments, GET /payments/:id, GET /users/me/payments).
 * - gRPC (GRPC_PORT): consultas internas de backend (PaymentsService, ver
 *   proto/payments.proto).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(httpMetricsMiddleware);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'parking.payments.v1',
      // process.cwd(), no __dirname: misma ruta con ts-node (dev) y compilado (Docker).
      protoPath: join(process.cwd(), 'proto', 'payments.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 50052}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3020);
  startMetricsServer();
}
bootstrap();
