import { Inject, Injectable } from '@nestjs/common';
import { ParkingSession } from '../../../domain/entities/parking-session.entity';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { InvalidQrCodeError } from '../../../domain/errors/invalid-qr-code.error';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { PARKING_POLICY, RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';
import type { ClockPort } from '../../ports/clock.port';
import type { QrCodePort } from '../../ports/qr-code.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { CLOCK, QR_CODE, REALTIME_NOTIFIER } from '../../ports/tokens';

export interface RegisterEntryInput {
  qrPayload: string;
}

@Injectable()
export class RegisterEntryUseCase {
  constructor(
    @Inject(QR_CODE) private readonly qrCode: QrCodePort,
    @Inject(PARKING_POLICY) private readonly parkingPolicy: ParkingPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
  ) {}

  async execute(input: RegisterEntryInput): Promise<ParkingSession> {
    const payload = this.qrCode.verify(input.qrPayload);
    if (payload.type !== 'ENTRY' || !payload.reservationId) {
      throw new InvalidQrCodeError();
    }

    const now = this.clock.now();
    const session = await this.parkingPolicy.registerEntry({ reservationId: payload.reservationId, now });

    const reservation = await this.reservations.findById(payload.reservationId);
    if (reservation) {
      this.notifier.notifyEntryRegistered({
        sessionId: session.id,
        branchId: reservation.branchId,
        slotId: session.slotId,
        userId: session.userId,
      });
      this.notifier.notifySlotStatusChanged({
        branchId: reservation.branchId,
        slotId: session.slotId,
        status: SlotStatus.OCUPADA,
      });
      this.notifier.notifyOccupancyUpdated(reservation.branchId);
    }

    return session;
  }
}
