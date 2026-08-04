import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ExpireOverdueReservationsPort } from '../../../core/ports/in/reservations/expire-overdue-reservations.port';
import { EXPIRE_OVERDUE_RESERVATIONS } from '../../../core/ports/in/tokens';

/** Politica 7: ejecuta el barrido de reservas vencidas cada minuto. */
@Injectable()
export class ReservationExpirationScheduler {
  private readonly logger = new Logger(ReservationExpirationScheduler.name);

  constructor(
    @Inject(EXPIRE_OVERDUE_RESERVATIONS)
    private readonly expireOverdueReservations: ExpireOverdueReservationsPort,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    const expiredCount = await this.expireOverdueReservations.execute();
    if (expiredCount > 0) {
      this.logger.log(`Reservas expiradas liberadas: ${expiredCount}`);
    }
  }
}
