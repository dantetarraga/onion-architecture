import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../adapters/out/persistence/prisma/prisma.module';
import { AuthModule } from './auth.module';
import { CoreInfraModule } from './core-infra.module';
import { RepositoriesModule } from './repositories.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RepositoriesModule,
    CoreInfraModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
