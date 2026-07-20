import { Inject, Injectable } from '@nestjs/common';
import { ParkingSession } from '../../../domain/entities/parking-session.entity';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { InvalidQrCodeError } from '../../../domain/errors/invalid-qr-code.error';
import { PaymentNotApprovedError } from '../../../domain/errors/payment-not-approved.error';
import { SessionNotActiveError } from '../../../domain/errors/session-not-active.error';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { PARKING_POLICY, PARKING_SESSION_REPOSITORY, RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';
import type { ClockPort } from '../../ports/clock.port';
import type { QrCodePort } from '../../ports/qr-code.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { CLOCK, QR_CODE, REALTIME_NOTIFIER } from '../../ports/tokens';

export interface RegisterExitInput {
  qrPayload: string;
}

@Injectable()
export class RegisterExitUseCase {
  constructor(
    @Inject(QR_CODE) private readonly qrCode: QrCodePort,
    @Inject(PARKING_POLICY) private readonly parkingPolicy: ParkingPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
    @Inject(PARKING_SESSION_REPOSITORY) private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
  ) {}

  async execute(input: RegisterExitInput): Promise<ParkingSession> {
    const payload = this.qrCode.verify(input.qrPayload);
    if (payload.type !== 'EXIT' || !payload.sessionId) {
      throw new InvalidQrCodeError();
    }

    const now = this.clock.now();
    const result = await this.parkingPolicy.registerExit({ sessionId: payload.sessionId, now });

    if (result.outcome === 'REJECTED') {
      if (result.reason === 'NO_ACTIVE_SESSION') {
        throw new SessionNotActiveError();
      }
      throw new PaymentNotApprovedError();
    }

    const reservation = await this.reservations.findById(result.session.reservationId);
    if (reservation) {
      this.notifier.notifyExitRegistered({
        sessionId: result.session.id,
        branchId: reservation.branchId,
        slotId: result.session.slotId,
      });
      this.notifier.notifySlotStatusChanged({
        branchId: reservation.branchId,
        slotId: result.session.slotId,
        status: SlotStatus.DISPONIBLE,
      });
      this.notifier.notifyOccupancyUpdated(reservation.branchId);
    }

    return result.session;
  }
}
