import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BalancedSlotAssignmentPolicy } from '../../domain/policies/impl/balanced-slot-assignment.policy';
import { DefaultParkingPolicy } from '../../domain/policies/impl/default-parking.policy';
import { DefaultReservationPolicy } from '../../domain/policies/impl/default-reservation.policy';
import { DefaultSlotAssignmentPolicy } from '../../domain/policies/impl/default-slot-assignment.policy';
import { HourlyPricingPolicy } from '../../domain/policies/impl/hourly-pricing.policy';
import type { SlotAssignmentPolicy } from '../../domain/policies/slot-assignment.policy';
import type { BranchRepositoryPort } from '../../domain/ports/branch.repository.port';
import type { ParkingSessionRepositoryPort } from '../../domain/ports/parking-session.repository.port';
import type { ParkingSlotRepositoryPort } from '../../domain/ports/parking-slot.repository.port';
import type { PaymentRepositoryPort } from '../../domain/ports/payment.repository.port';
import type { ReservationRepositoryPort } from '../../domain/ports/reservation.repository.port';
import {
  BRANCH_REPOSITORY,
  PARKING_POLICY,
  PARKING_SESSION_REPOSITORY,
  PARKING_SLOT_REPOSITORY,
  PAYMENT_REPOSITORY,
  PRICING_POLICY,
  RESERVATION_POLICY,
  RESERVATION_REPOSITORY,
  SLOT_ASSIGNMENT_POLICY,
} from '../../domain/ports/tokens';

const DEFAULT_TOLERANCE_MINUTES = 20;

@Global()
@Module({
  providers: [
    {
      provide: SLOT_ASSIGNMENT_POLICY,
      useFactory: (
        slots: ParkingSlotRepositoryPort,
        branches: BranchRepositoryPort,
        config: ConfigService,
      ): SlotAssignmentPolicy => {
        const strategy = config.get<string>('SLOT_ASSIGNMENT_STRATEGY') ?? 'default';
        return strategy === 'balanced'
          ? new BalancedSlotAssignmentPolicy(slots, branches)
          : new DefaultSlotAssignmentPolicy(slots, branches);
      },
      inject: [PARKING_SLOT_REPOSITORY, BRANCH_REPOSITORY, ConfigService],
    },
    {
      provide: PRICING_POLICY,
      useFactory: (branches: BranchRepositoryPort) => new HourlyPricingPolicy(branches),
      inject: [BRANCH_REPOSITORY],
    },
    {
      provide: RESERVATION_POLICY,
      useFactory: (
        reservations: ReservationRepositoryPort,
        sessions: ParkingSessionRepositoryPort,
        config: ConfigService,
      ) =>
        new DefaultReservationPolicy(
          reservations,
          sessions,
          Number(config.get('RESERVATION_TOLERANCE_MINUTES') ?? DEFAULT_TOLERANCE_MINUTES),
        ),
      inject: [RESERVATION_REPOSITORY, PARKING_SESSION_REPOSITORY, ConfigService],
    },
    {
      provide: PARKING_POLICY,
      useFactory: (
        reservations: ReservationRepositoryPort,
        sessions: ParkingSessionRepositoryPort,
        slots: ParkingSlotRepositoryPort,
        payments: PaymentRepositoryPort,
      ) => new DefaultParkingPolicy(reservations, sessions, slots, payments),
      inject: [RESERVATION_REPOSITORY, PARKING_SESSION_REPOSITORY, PARKING_SLOT_REPOSITORY, PAYMENT_REPOSITORY],
    },
  ],
  exports: [SLOT_ASSIGNMENT_POLICY, PRICING_POLICY, RESERVATION_POLICY, PARKING_POLICY],
})
export class PoliciesModule {}
