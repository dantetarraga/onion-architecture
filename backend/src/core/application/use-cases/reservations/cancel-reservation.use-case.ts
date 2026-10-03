import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ReservationStatus } from '../../../domain/enums/reservation-status.enum';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { ReservationExpiredError } from '../../../domain/errors/reservation-expired.error';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../ports/out/tokens';
import { PARKING_POLICY } from '../../../domain/policies/policy-tokens';
import type { RealtimeNotifierPort } from '../../../ports/out/realtime-notifier.port';
import type { AuditEventPublisherPort } from '../../../ports/out/audit-event-publisher.port';
import { AUDIT_EVENT_PUBLISHER, REALTIME_NOTIFIER } from '../../../ports/out/tokens';
import type { CancelReservationPort } from '../../../ports/in/reservations/cancel-reservation.port';

export interface CancelReservationInput {
  reservationId: string;
  userId: string;
}

@Injectable()
export class CancelReservationUseCase implements CancelReservationPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(PARKING_POLICY) private readonly parkingPolicy: ParkingPolicy,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
    @Inject(AUDIT_EVENT_PUBLISHER)
    private readonly auditEvents: AuditEventPublisherPort,
  ) {}

  async execute(input: CancelReservationInput): Promise<void> {
    const reservation = await this.reservations.findById(input.reservationId);
    if (!reservation || reservation.userId !== input.userId) {
      throw new NotFoundError('Reservation', input.reservationId);
    }

    if (
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.CONFIRMED
    ) {
      throw new ReservationExpiredError(
        'La reserva no se puede cancelar en su estado actual.',
      );
    }

    await this.reservations.updateStatus(
      reservation.id,
      ReservationStatus.CANCELLED,
    );
    await this.parkingPolicy.releaseSlot(reservation.slotId);

    void this.auditEvents.publishAuditEvent({
      eventId: randomUUID(),
      eventType: 'reservation.cancelled',
      occurredAt: new Date().toISOString(),
      aggregateId: reservation.id,
      actorUserId: input.userId,
      payload: {
        reservationId: reservation.id,
        branchId: reservation.branchId,
        slotId: reservation.slotId,
        status: ReservationStatus.CANCELLED,
      },
    });

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
