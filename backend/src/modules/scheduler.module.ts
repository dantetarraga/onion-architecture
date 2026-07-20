import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReservationExpirationScheduler } from '../infrastructure/scheduler/reservation-expiration.scheduler';
import { ReservationsModule } from './reservations.module';

@Module({
  imports: [ScheduleModule.forRoot(), ReservationsModule],
  providers: [ReservationExpirationScheduler],
})
export class SchedulerModule {}
