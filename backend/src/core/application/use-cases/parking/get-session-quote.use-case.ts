import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type {
  PricingPolicy,
  PricingResult,
} from '../../../domain/policies/pricing.policy';
import { PRICING_POLICY } from '../../../domain/policies/policy-tokens';
import type { ClockPort } from '../../../ports/out/clock.port';
import type { ParkingSessionRepositoryPort } from '../../../ports/out/parking-session.repository.port';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import {
  CLOCK,
  PARKING_SESSION_REPOSITORY,
  RESERVATION_REPOSITORY,
} from '../../../ports/out/tokens';
import type { GetSessionQuotePort } from '../../../ports/in/parking/get-session-quote.port';

export interface SessionQuote extends PricingResult {
  sessionId: string;
  userId: string;
  branchId: string;
  active: boolean;
}

/**
 * Cotizacion de una sesion para payments-service (via gRPC, ver
 * proto/parking.proto). A diferencia de CalculateAmountUseCase no valida
 * dueño: el llamador es un servicio interno, y payments-service compara
 * `userId` contra el usuario del token antes de cobrar.
 */
@Injectable()
export class GetSessionQuoteUseCase implements GetSessionQuotePort {
  constructor(
    @Inject(PARKING_SESSION_REPOSITORY)
    private readonly sessions: ParkingSessionRepositoryPort,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(PRICING_POLICY) private readonly pricingPolicy: PricingPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(sessionId: string): Promise<SessionQuote> {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('ParkingSession', sessionId);
    }

    const reservation = await this.reservations.findById(session.reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', session.reservationId);
    }

    const pricing = await this.pricingPolicy.calculate({
      branchId: reservation.branchId,
      slotType: reservation.requestedType,
      entryAt: session.entryAt,
      exitAt: session.exitAt ?? this.clock.now(),
      userId: session.userId,
    });

    return {
      sessionId: session.id,
      userId: session.userId,
      branchId: reservation.branchId,
      active: session.isActive(),
      ...pricing,
    };
  }
}
