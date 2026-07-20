import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { PaymentMethod } from '../../../domain/policies/payment-method.port';
import type { PricingPolicy } from '../../../domain/policies/pricing.policy';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import type { PaymentRepositoryPort } from '../../../domain/ports/payment.repository.port';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import {
  PARKING_SESSION_REPOSITORY,
  PAYMENT_METHOD,
  PAYMENT_REPOSITORY,
  PRICING_POLICY,
  RESERVATION_REPOSITORY,
} from '../../../domain/ports/tokens';
import type { ClockPort } from '../../ports/clock.port';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { CLOCK, REALTIME_NOTIFIER } from '../../ports/tokens';

export interface RegisterPaymentInput {
  sessionId: string;
  userId: string;
}

@Injectable()
export class RegisterPaymentUseCase {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY) private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(PRICING_POLICY) private readonly pricingPolicy: PricingPolicy,
    @Inject(PAYMENT_METHOD) private readonly paymentMethod: PaymentMethod,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(input: RegisterPaymentInput): Promise<Payment> {
    const session = await this.sessions.findById(input.sessionId);
    if (!session || session.userId !== input.userId) {
      throw new NotFoundError('ParkingSession', input.sessionId);
    }

    const existingPayment = await this.payments.findBySessionId(session.id);
    if (existingPayment) {
      return existingPayment;
    }

    const reservation = await this.reservations.findById(session.reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', session.reservationId);
    }

    const now = this.clock.now();
    const pricing = await this.pricingPolicy.calculate({
      branchId: reservation.branchId,
      slotType: reservation.requestedType,
      entryAt: session.entryAt,
      exitAt: now,
      userId: session.userId,
    });

    const charge = await this.paymentMethod.charge({
      sessionId: session.id,
      amount: pricing.amount,
      currency: pricing.currency,
    });

    const payment = await this.payments.create({
      sessionId: session.id,
      userId: session.userId,
      amount: pricing.amount,
      status: charge.status === 'APPROVED' ? PaymentStatus.APPROVED : PaymentStatus.REJECTED,
      externalReference: charge.externalReference,
      paidAt: charge.status === 'APPROVED' ? now : null,
    });

    this.notifier.notifyPaymentRegistered({
      paymentId: payment.id,
      sessionId: session.id,
      amount: payment.amount,
      status: payment.status,
    });

    return payment;
  }
}
