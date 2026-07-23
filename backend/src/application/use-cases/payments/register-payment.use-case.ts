import { Inject, Injectable } from '@nestjs/common';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentMethodType } from '../../../domain/enums/payment-method-type.enum';
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
  method: PaymentMethodType;
}

const TOLERANCE = 0.01;

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

    const existingPayment = await this.payments.findBySessionId(session.id);
    if (existingPayment) {
      return this.topUpIfInsufficient(
        existingPayment,
        pricing.amount,
        pricing.currency,
        session.id,
        now,
        input.method,
      );
    }

    const charge = await this.paymentMethod.charge({
      sessionId: session.id,
      amount: pricing.amount,
      currency: pricing.currency,
      method: input.method,
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

  /**
   * Regulariza un pago existente si la tarifa recalculada al momento actual (sobre-estadia,
   * ver E3/RegisterExitUseCase) supera lo ya pagado. Como `sessionId` es @unique en `payments`,
   * no se crea una fila nueva: se incrementa el monto del pago existente.
   */
  private async topUpIfInsufficient(
    existingPayment: Payment,
    requiredAmount: number,
    currency: 'PEN',
    sessionId: string,
    now: Date,
    method: PaymentMethodType,
  ): Promise<Payment> {
    const missingAmount = Number((requiredAmount - existingPayment.amount).toFixed(2));
    if (missingAmount <= TOLERANCE) {
      return existingPayment;
    }

    const charge = await this.paymentMethod.charge({ sessionId, amount: missingAmount, currency, method });
    if (charge.status !== 'APPROVED') {
      return existingPayment;
    }

    const toppedUp = await this.payments.increaseAmount(
      existingPayment.id,
      missingAmount,
      charge.externalReference,
      now,
    );

    this.notifier.notifyPaymentRegistered({
      paymentId: toppedUp.id,
      sessionId,
      amount: toppedUp.amount,
      status: toppedUp.status,
    });

    return toppedUp;
  }
}
