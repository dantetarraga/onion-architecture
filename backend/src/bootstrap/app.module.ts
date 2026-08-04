import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreInfraModule } from './core-infra.module';
import { PoliciesModule } from './policies.module';
import { RepositoriesModule } from './repositories.module';
import { MongoModule } from '../adapters/out/persistence/mongodb/mongo.module';
import { RealtimeModule } from './realtime.module';
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
    MongoModule,
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
