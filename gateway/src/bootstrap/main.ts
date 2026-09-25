import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createServicesProxy } from '../proxy/proxy.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Smart Parking System API (gateway)')
    .setDescription('Gateway publico: auth via gRPC a auth-service; pagos, tiempo real y el resto por proxy HTTP a payments-service, realtime-service y backend.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Fallback: cualquier ruta que no sea propia del gateway (todo lo que no es
  // /auth/* o GET /users/me) se reenvia a su servicio ANTES de llegar al router
  // de Nest (ver el filtro por path dentro de createServicesProxy: el router
  // de Nest no hace fallthrough en un 404 real, asi que la decision no puede
  // depender del orden de registro en Express).
  const proxy = createServicesProxy();
  app.use(proxy);

  const server = await app.listen(process.env.PORT ?? 3000);
  server.on('upgrade', proxy.upgrade);
}
bootstrap();
