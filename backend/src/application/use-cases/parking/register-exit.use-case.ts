import { Inject, Injectable } from '@nestjs/common';
import { ParkingSession } from '../../../domain/entities/parking-session.entity';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { InvalidQrCodeError } from '../../../domain/errors/invalid-qr-code.error';
import { OverstayPaymentInsufficientError } from '../../../domain/errors/overstay-payment-insufficient.error';
import { PaymentNotApprovedError } from '../../../domain/errors/payment-not-approved.error';
import { SessionNotActiveError } from '../../../domain/errors/session-not-active.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ParkingPolicy } from '../../../domain/policies/parking.policy';
import type { PricingPolicy } from '../../../domain/policies/pricing.policy';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import type { PaymentRepositoryPort } from '../../../domain/ports/payment.repository.port';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import {
  PARKING_POLICY,
  PARKING_SESSION_REPOSITORY,
  PAYMENT_REPOSITORY,
  PRICING_POLICY,
  RESERVATION_REPOSITORY,
} from '../../../domain/ports/tokens';
import type { ClockPort } from '../../ports/clock.port';
import type { QrCodePort } from '../../ports/qr-code.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { CLOCK, QR_CODE, REALTIME_NOTIFIER } from '../../ports/tokens';

export interface RegisterExitInput {
  qrPayload: string;
}

const OVERSTAY_TOLERANCE = 0.01;

@Injectable()
export class RegisterExitUseCase {
  constructor(
    @Inject(QR_CODE) private readonly qrCode: QrCodePort,
    @Inject(PARKING_POLICY) private readonly parkingPolicy: ParkingPolicy,
    @Inject(PRICING_POLICY) private readonly pricingPolicy: PricingPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
    @Inject(PARKING_SESSION_REPOSITORY) private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
  ) {}

  async execute(input: RegisterExitInput): Promise<ParkingSession> {
    const payload = this.qrCode.verify(input.qrPayload);
    if (payload.type !== 'EXIT' || !payload.sessionId) {
      throw new InvalidQrCodeError();
    }

    const now = this.clock.now();

    const session = await this.sessions.findById(payload.sessionId);
    if (!session || !session.isActive()) {
      throw new SessionNotActiveError();
    }

    const reservation = await this.reservations.findById(session.reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', session.reservationId);
    }

    const payment = await this.payments.findBySessionId(session.id);
    if (!payment || !payment.isApproved()) {
      throw new PaymentNotApprovedError();
    }

    const pricing = await this.pricingPolicy.calculate({
      branchId: reservation.branchId,
      slotType: reservation.requestedType,
      entryAt: session.entryAt,
      exitAt: now,
      userId: session.userId,
    });

    const missingAmount = Number((pricing.amount - payment.amount).toFixed(2));
    if (missingAmount > OVERSTAY_TOLERANCE) {
      throw new OverstayPaymentInsufficientError(missingAmount);
    }

    const result = await this.parkingPolicy.registerExit({ sessionId: payload.sessionId, now });

    if (result.outcome === 'REJECTED') {
      if (result.reason === 'NO_ACTIVE_SESSION') {
        throw new SessionNotActiveError();
      }
      throw new PaymentNotApprovedError();
    }

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

    return result.session;
  }
}
