import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpireOverdueReservationsUseCase } from '../../application/use-cases/reservations/expire-overdue-reservations.use-case';

/** Politica 7: ejecuta el barrido de reservas vencidas cada minuto. */
@Injectable()
export class ReservationExpirationScheduler {
  private readonly logger = new Logger(ReservationExpirationScheduler.name);

  constructor(private readonly expireOverdueReservations: ExpireOverdueReservationsUseCase) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    const expiredCount = await this.expireOverdueReservations.execute();
    if (expiredCount > 0) {
      this.logger.log(`Reservas expiradas liberadas: ${expiredCount}`);
    }
  }
}
