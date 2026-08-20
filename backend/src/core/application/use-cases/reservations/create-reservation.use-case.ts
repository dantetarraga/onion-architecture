import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Branch } from '../../../domain/entities/branch.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { NoAvailabilityError } from '../../../domain/errors/no-availability.error';
import { ReservationAlreadyActiveError } from '../../../domain/errors/reservation-already-active.error';
import type { BranchRepositoryPort } from '../../../ports/out/branch.repository.port';
import type { ReservationRepositoryPort } from '../../../ports/out/reservation.repository.port';
import type { UserRepositoryPort } from '../../../ports/out/user.repository.port';
import {
  BRANCH_REPOSITORY,
  RESERVATION_REPOSITORY,
  USER_REPOSITORY,
} from '../../../ports/out/tokens';
import {
  RESERVATION_POLICY,
  SLOT_ASSIGNMENT_POLICY,
} from '../../../domain/policies/policy-tokens';
import type { ReservationPolicy } from '../../../domain/policies/reservation.policy';
import type { SlotAssignmentPolicy } from '../../../domain/policies/slot-assignment.policy';
import type { ClockPort } from '../../../ports/out/clock.port';
import type { NotificationPublisherPort } from '../../../ports/out/notification-publisher.port';
import type { RealtimeNotifierPort } from '../../../ports/out/realtime-notifier.port';
import {
  CLOCK,
  NOTIFICATION_PUBLISHER,
  REALTIME_NOTIFIER,
} from '../../../ports/out/tokens';
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
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepositoryPort,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisherPort,
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

    await this.publishConfirmationEmail(reservation);

    return { outcome: 'CREATED', reservation };
  }

  /**
   * Publica el evento de confirmacion en la cola (Kafka) para que el
   * servicio externo de notificaciones envie el correo. Efecto secundario:
   * si el usuario o la sucursal no se pueden leer (no deberia pasar, ya
   * que ambos IDs se acaban de usar para crear la reserva), o si Kafka
   * falla, no se interrumpe la confirmacion de la reserva.
   */
  private async publishConfirmationEmail(
    reservation: Reservation,
  ): Promise<void> {
    const [user, branch] = await Promise.all([
      this.users.findById(reservation.userId),
      this.branches.findById(reservation.branchId),
    ]);

    if (!user || !branch) {
      return;
    }

    await this.notifications.publishReservationConfirmation({
      eventId: randomUUID(),
      eventType: 'reservation.confirmation.email',
      occurredAt: this.clock.now(),
      reservationId: reservation.id,
      userId: user.id,
      userEmail: user.email,
      userFullName: user.fullName,
      branchId: branch.id,
      branchName: branch.name,
      branchAddress: branch.address,
      slotId: reservation.slotId,
      startAt: reservation.startAt,
      expiresAt: reservation.expiresAt,
    });
  }
}
