import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { httpMetricsMiddleware, startMetricsServer } from '../observability/metrics';
import { DomainExceptionFilter } from '../adapters/in/http/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(httpMetricsMiddleware);

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Smart Parking System API')
    .setDescription('Sistema Inteligente de Gestion de Estacionamientos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Entrada gRPC interna (ParkingService, ver proto/parking.proto): hoy la usa
  // payments-service para cotizar una sesion antes de cobrarla. El worker
  // (worker-main.ts) no la levanta: no atiende a otros servicios.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'parking.core.v1',
      protoPath: join(process.cwd(), 'proto', 'parking.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 50053}`,
    },
  });
  await app.startAllMicroservices();

  await app.listen(process.env.PORT ?? 3001);
  startMetricsServer();
}
bootstrap();
