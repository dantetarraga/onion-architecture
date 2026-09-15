import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CoreInfraModule } from './core-infra.module';
import { PoliciesModule } from './policies.module';
import { RepositoriesModule } from './repositories.module';
import { PrismaModule } from '../adapters/out/persistence/prisma/prisma.module';
import { RealtimeModule } from './realtime.module';
import { MessagingModule } from './messaging.module';
import { AdminModule } from './admin.module';
import { AuthModule } from './auth.module';
import { BranchesModule } from './branches.module';
import { ParkingModule } from './parking.module';
import { PaymentsModule } from './payments.module';
import { ReservationsModule } from './reservations.module';
import { SchedulerModule } from './scheduler.module';
import { UsersModule } from './users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Solo aplica donde se usa ThrottlerGuard explicitamente (endpoints MFA); el resto de la API no se limita.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    PrismaModule,
    RepositoriesModule,
    PoliciesModule,
    CoreInfraModule,
    RealtimeModule,
    MessagingModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    ReservationsModule,
    ParkingModule,
    PaymentsModule,
    AdminModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
