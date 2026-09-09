import { Reservation } from '../entities/reservation.entity';

export interface ReservationEligibility {
  allowed: boolean;
  reason?: 'ACTIVE_RESERVATION_EXISTS' | 'ACTIVE_SESSION_EXISTS';
}

/**
 * Valida disponibilidad, ventana de tolerancia y limite de reservas por usuario
 * (Politicas 2 y 3).
 */
export interface ReservationPolicy {
  canCreateReservation(userId: string): Promise<ReservationEligibility>;
  getToleranceWindowMinutes(): number;
  isExpired(reservation: Reservation, now: Date): boolean;
  calculateExpiresAt(createdAt: Date): Date;
}
