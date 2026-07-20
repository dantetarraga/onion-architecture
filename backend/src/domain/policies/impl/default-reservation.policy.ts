import { Reservation } from '../../entities/reservation.entity';
import { ParkingSessionRepositoryPort } from '../../ports/parking-session.repository.port';
import { ReservationRepositoryPort } from '../../ports/reservation.repository.port';
import { ReservationEligibility, ReservationPolicy } from '../reservation.policy';

export class DefaultReservationPolicy implements ReservationPolicy {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly sessions: ParkingSessionRepositoryPort,
    private readonly toleranceMinutes: number,
  ) {}

  async canCreateReservation(userId: string): Promise<ReservationEligibility> {
    const activeReservation = await this.reservations.findActiveByUser(userId);
    if (activeReservation) {
      return { allowed: false, reason: 'ACTIVE_RESERVATION_EXISTS' };
    }

    const activeSession = await this.sessions.findActiveByUser(userId);
    if (activeSession) {
      return { allowed: false, reason: 'ACTIVE_SESSION_EXISTS' };
    }

    return { allowed: true };
  }

  getToleranceWindowMinutes(): number {
    return this.toleranceMinutes;
  }

  isExpired(reservation: Reservation, now: Date): boolean {
    return reservation.isPending() && now.getTime() > reservation.expiresAt.getTime();
  }

  calculateExpiresAt(createdAt: Date): Date {
    return new Date(createdAt.getTime() + this.toleranceMinutes * 60_000);
  }
}
