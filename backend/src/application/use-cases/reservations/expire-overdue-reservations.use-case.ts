import { Inject, Injectable } from '@nestjs/common';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { ReservationPolicy } from '../../../domain/policies/reservation.policy';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { PARKING_POLICY, RESERVATION_POLICY, RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';
import type { ClockPort } from '../../ports/clock.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { CLOCK, REALTIME_NOTIFIER } from '../../ports/tokens';

/**
 * Politica 7: barrido de reservas vencidas. Invocado por el scheduler cada
 * minuto y tambien por el endpoint admin `expire-now` para la demo en vivo.
 */
@Injectable()
export class ExpireOverdueReservationsUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
    @Inject(RESERVATION_POLICY) private readonly reservationPolicy: ReservationPolicy,
    @Inject(PARKING_POLICY) private readonly parkingPolicy: ParkingPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(): Promise<number> {
    const now = this.clock.now();
    const candidates = await this.reservations.findExpiredPending(now);
    let expiredCount = 0;

    for (const reservation of candidates) {
      if (!this.reservationPolicy.isExpired(reservation, now)) {
        continue;
      }

      await this.reservations.updateStatus(reservation.id, ReservationStatus.EXPIRED);
      await this.parkingPolicy.releaseSlot(reservation.slotId);

      this.notifier.notifyReservationExpired({
        reservationId: reservation.id,
        branchId: reservation.branchId,
        slotId: reservation.slotId,
      });
      this.notifier.notifySlotStatusChanged({
        branchId: reservation.branchId,
        slotId: reservation.slotId,
        status: SlotStatus.DISPONIBLE,
      });
      this.notifier.notifyOccupancyUpdated(reservation.branchId);

      expiredCount++;
    }

    return expiredCount;
  }
}
