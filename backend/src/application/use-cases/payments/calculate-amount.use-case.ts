import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { PricingPolicy, PricingResult } from '../../../domain/policies/pricing.policy';
import type { ParkingSessionRepositoryPort } from '../../../domain/ports/parking-session.repository.port';
import type { ReservationRepositoryPort } from '../../../domain/ports/reservation.repository.port';
import { PARKING_SESSION_REPOSITORY, PRICING_POLICY, RESERVATION_REPOSITORY } from '../../../domain/ports/tokens';
import type { ClockPort } from '../../ports/clock.port';
import { CLOCK } from '../../ports/tokens';

export interface CalculateAmountInput {
  sessionId: string;
  userId: string;
}

@Injectable()
export class CalculateAmountUseCase {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY) private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
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
