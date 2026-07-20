import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreInfraModule } from './infrastructure/modules/core-infra.module';
import { PoliciesModule } from './infrastructure/modules/policies.module';
import { RepositoriesModule } from './infrastructure/modules/repositories.module';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { RealtimeModule } from './infrastructure/websocket/realtime.module';
import { AdminModule } from './modules/admin.module';
import { AuthModule } from './modules/auth.module';
import { BranchesModule } from './modules/branches.module';
import { ParkingModule } from './modules/parking.module';
import { PaymentsModule } from './modules/payments.module';
import { ReservationsModule } from './modules/reservations.module';
import { SchedulerModule } from './modules/scheduler.module';
import { UsersModule } from './modules/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RepositoriesModule,
    PoliciesModule,
    CoreInfraModule,
    RealtimeModule,
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
