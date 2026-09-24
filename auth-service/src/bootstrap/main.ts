import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'parking.auth.v1',
      // process.cwd(), no __dirname: la ruta debe ser la misma corriendo con
      // ts-node (dev, cwd=auth-service/) o compilado (Docker, WORKDIR=/app),
      // sin importar si dist/ replica o no la profundidad de carpetas de src/.
      protoPath: join(process.cwd(), 'proto', 'auth.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 50051}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3010);
}
bootstrap();
