import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
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
  CLOCK,
  NOTIFICATION_PUBLISHER,
  REALTIME_NOTIFIER,
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
  private readonly logger = new Logger(CreateReservationUseCase.name);

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
   * la reserva ya quedo confirmada y notificada por WS antes de llegar aqui,
   * asi que ningun fallo de este metodo (lectura de user/branch o el publish
   * en si) debe propagarse - se loguea y se sigue, nunca se relanza.
   */
  private async publishConfirmationEmail(
    reservation: Reservation,
  ): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.warn(
        `No se pudo publicar la confirmacion de la reserva ${reservation.id} (la reserva si quedo creada): ${(error as Error).message}`,
      );
    }
  }
}
