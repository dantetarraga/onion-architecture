import { Inject, Injectable } from '@nestjs/common';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { ReservationExpiredError } from '../../../domain/errors/reservation-expired.error';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { PARKING_POLICY, RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { REALTIME_NOTIFIER } from '../../ports/tokens';

export interface CancelReservationInput {
  reservationId: string;
  userId: string;
}

@Injectable()
export class CancelReservationUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
    @Inject(PARKING_POLICY) private readonly parkingPolicy: ParkingPolicy,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(input: CancelReservationInput): Promise<void> {
    const reservation = await this.reservations.findById(input.reservationId);
    if (!reservation || reservation.userId !== input.userId) {
      throw new NotFoundError('Reservation', input.reservationId);
    }

    if (reservation.status !== ReservationStatus.PENDING && reservation.status !== ReservationStatus.CONFIRMED) {
      throw new ReservationExpiredError('La reserva no se puede cancelar en su estado actual.');
    }

    await this.reservations.updateStatus(reservation.id, ReservationStatus.CANCELLED);
    await this.parkingPolicy.releaseSlot(reservation.slotId);

    this.notifier.notifyReservationCancelled({
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
  }
}
