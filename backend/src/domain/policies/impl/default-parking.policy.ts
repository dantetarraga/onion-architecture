import { ParkingSession } from '../../entities/parking-session.entity';
import { ReservationStatus } from '../../enums/reservation-status.enum';
import { SlotStatus } from '../../enums/slot-status.enum';
import { ReservationExpiredError } from '../../errors/reservation-expired.error';
import { NotFoundError } from '../../errors/not-found.error';
import { ParkingSessionRepositoryPort } from '../../ports/parking-session.repository.port';
import { ParkingSlotRepositoryPort } from '../../ports/parking-slot.repository.port';
import { PaymentRepositoryPort } from '../../ports/payment.repository.port';
import { ReservationRepositoryPort } from '../../ports/reservation.repository.port';
import { ExitResult, ParkingPolicy, RegisterEntryInput, RegisterExitInput } from '../parking.policy';

/** Politicas 5 y 6: registro de ingreso/salida y transiciones de estado de cocheras. */
export class DefaultParkingPolicy implements ParkingPolicy {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly sessions: ParkingSessionRepositoryPort,
    private readonly slots: ParkingSlotRepositoryPort,
    private readonly payments: PaymentRepositoryPort,
  ) {}

  async registerEntry(input: RegisterEntryInput): Promise<ParkingSession> {
    const reservation = await this.reservations.findById(input.reservationId);
    if (!reservation) {
      throw new NotFoundError('Reservation', input.reservationId);
    }
    if (
      reservation.status === ReservationStatus.EXPIRED ||
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED
    ) {
      throw new ReservationExpiredError();
    }

    if (reservation.status === ReservationStatus.PENDING) {
      await this.reservations.updateStatus(reservation.id, ReservationStatus.CONFIRMED, input.now);
    }

    const session = await this.sessions.create({
      reservationId: reservation.id,
      userId: reservation.userId,
      slotId: reservation.slotId,
      entryAt: input.now,
    });

    await this.slots.updateStatus(reservation.slotId, SlotStatus.OCUPADA);

    return session;
  }

  async registerExit(input: RegisterExitInput): Promise<ExitResult> {
    const session = await this.sessions.findById(input.sessionId);
    if (!session || !session.isActive()) {
      return { outcome: 'REJECTED', reason: 'NO_ACTIVE_SESSION' };
    }

    const payment = await this.payments.findBySessionId(session.id);
    if (!payment || !payment.isApproved()) {
      return { outcome: 'REJECTED', reason: 'PAYMENT_NOT_APPROVED' };
    }

    await this.sessions.markCompleted(session.id, input.now);
    await this.releaseSlot(session.slotId);
    await this.reservations.updateStatus(session.reservationId, ReservationStatus.COMPLETED);

    const updatedSession = await this.sessions.findById(session.id);
    return { outcome: 'RELEASED', session: updatedSession as ParkingSession };
  }

  async releaseSlot(slotId: string): Promise<void> {
    await this.slots.updateStatus(slotId, SlotStatus.DISPONIBLE);
  }
}
