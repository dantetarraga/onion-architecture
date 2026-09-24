import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createBackendProxy } from '../proxy/proxy.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Smart Parking System API (gateway)')
    .setDescription('Gateway publico: auth via gRPC a auth-service, el resto proxy a backend.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Fallback: cualquier ruta que Nest no matcheo (todo lo que no es /auth/* o
  // GET /users/me) sigue de largo hacia backend. Debe registrarse DESPUES de
  // que Nest arma su router interno para que las rutas propias del gateway
  // (auth/users) sigan teniendo prioridad.
  const proxy = createBackendProxy();
  app.use(proxy);

  const server = await app.listen(process.env.PORT ?? 3000);
  server.on('upgrade', proxy.upgrade);
}
bootstrap();
