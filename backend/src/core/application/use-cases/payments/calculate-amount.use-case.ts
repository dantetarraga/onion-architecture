import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type {
  PricingPolicy,
  PricingResult,
} from '../../../domain/policies/pricing.policy';
import type { ParkingSessionRepositoryPort } from '../../../ports/out/parking-session.repository.port';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import {
  PARKING_SESSION_REPOSITORY,
  RESERVATION_REPOSITORY,
} from '../../../ports/out/tokens';
import { PRICING_POLICY } from '../../../domain/policies/policy-tokens';
import type { ClockPort } from '../../../ports/out/clock.port';
import { CLOCK } from '../../../ports/out/tokens';
import type { CalculateAmountPort } from '../../../ports/in/payments/calculate-amount.port';

export interface CalculateAmountInput {
  sessionId: string;
  userId: string;
}

@Injectable()
export class CalculateAmountUseCase implements CalculateAmountPort {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY)
    private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(PRICING_POLICY) private readonly pricingPolicy: PricingPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: CalculateAmountInput): Promise<PricingResult> {
    const session = await this.sessions.findById(input.sessionId);
    if (!session || session.userId !== input.userId) {
      throw new NotFoundError('ParkingSession', input.sessionId);
    }

    const reservation = await this.reservations.findById(session.reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', session.reservationId);
    }

    const exitAt = session.exitAt ?? this.clock.now();

    return this.pricingPolicy.calculate({
      branchId: reservation.branchId,
      slotType: reservation.requestedType,
      entryAt: session.entryAt,
      exitAt,
      userId: session.userId,
    });
  }
}
