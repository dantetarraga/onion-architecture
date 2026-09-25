import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../adapters/out/persistence/prisma/prisma.module';
import { AppController } from './app.controller';
import { CoreInfraModule } from './core-infra.module';
import { PaymentsModule } from './payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CoreInfraModule,
    PaymentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
