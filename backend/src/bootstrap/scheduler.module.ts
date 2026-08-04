import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReservationExpirationScheduler } from '../adapters/in/scheduler/reservation-expiration.scheduler';
import { ReservationsModule } from './reservations.module';

@Module({
  imports: [ScheduleModule.forRoot(), ReservationsModule],
  providers: [ReservationExpirationScheduler],
})
export class SchedulerModule {}
