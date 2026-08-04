import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { NoAvailabilityError } from '../../../domain/errors/no-availability.error';
import { ReservationAlreadyActiveError } from '../../../domain/errors/reservation-already-active.error';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import { RESERVATION_REPOSITORY } from '../../../ports/out/tokens';
import {
  RESERVATION_POLICY,
  SLOT_ASSIGNMENT_POLICY,
} from '../../../domain/policies/policy-tokens';
import type { ReservationPolicy } from '../../../domain/policies/reservation.policy';
import type { SlotAssignmentPolicy } from '../../../domain/policies/slot-assignment.policy';
import type { ClockPort } from '../../../ports/out/clock.port';
import type { RealtimeNotifierPort } from '../../../ports/out/realtime-notifier.port';
import { CLOCK, REALTIME_NOTIFIER } from '../../../ports/out/tokens';
import type { CreateReservationPort } from '../../../ports/in/reservations/create-reservation.port';

export interface CreateReservationInput {
  userId: string;
  branchId: string;
  slotType?: SlotType;
  startAt?: Date;
}

export type CreateReservationResult =
  | { outcome: 'CREATED'; reservation: Reservation }
  | {
      outcome: 'SUGGEST_OTHER_BRANCH';
      suggestedBranch: Branch;
      distanceKm: number;
    };

@Injectable()
export class CreateReservationUseCase implements CreateReservationPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    @Inject(RESERVATION_POLICY)
    private readonly reservationPolicy: ReservationPolicy,
    @Inject(SLOT_ASSIGNMENT_POLICY)
    private readonly slotAssignmentPolicy: SlotAssignmentPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(
    input: CreateReservationInput,
  ): Promise<CreateReservationResult> {
    const eligibility = await this.reservationPolicy.canCreateReservation(
      input.userId,
    );
    if (!eligibility.allowed) {
      throw new ReservationAlreadyActiveError();
    }

    const assignment = await this.slotAssignmentPolicy.assign({
      branchId: input.branchId,
      slotType: input.slotType,
    });

    if (assignment.outcome === 'NO_AVAILABILITY') {
      throw new NoAvailabilityError();
    }

    if (assignment.outcome === 'SUGGEST_OTHER_BRANCH') {
      return {
        outcome: 'SUGGEST_OTHER_BRANCH',
        suggestedBranch: assignment.suggestedBranch,
        distanceKm: assignment.distanceKm,
      };
    }

    const now = this.clock.now();
    const startAt = input.startAt ?? now;
    const expiresAt = this.reservationPolicy.calculateExpiresAt(startAt);

    const reservation = await this.reservations.create({
      userId: input.userId,
      branchId: input.branchId,
      slotId: assignment.slot.id,
      requestedType: input.slotType ?? assignment.slot.type,
      startAt,
      expiresAt,
    });

    this.notifier.notifyReservationCreated({
      reservationId: reservation.id,
      branchId: reservation.branchId,
      slotId: reservation.slotId,
      userId: reservation.userId,
      expiresAt: reservation.expiresAt,
    });
    this.notifier.notifySlotStatusChanged({
      branchId: reservation.branchId,
      slotId: reservation.slotId,
      status: SlotStatus.RESERVADA,
    });
    this.notifier.notifyOccupancyUpdated(reservation.branchId);

    return { outcome: 'CREATED', reservation };
  }
}
