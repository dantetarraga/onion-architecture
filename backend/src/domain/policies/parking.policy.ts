import { ParkingSession } from '../entities/parking-session.entity';

export interface RegisterEntryInput {
  reservationId: string;
  now: Date;
}

export interface RegisterExitInput {
  sessionId: string;
  now: Date;
}

export type ExitResult =
  | { outcome: 'RELEASED'; session: ParkingSession }
  | { outcome: 'REJECTED'; reason: 'NO_ACTIVE_SESSION' | 'PAYMENT_NOT_APPROVED' };

/**
 * Registra ingreso/salida y gestiona las transiciones de estado de la cochera
 * (Politicas 5 y 6).
 */
export interface ParkingPolicy {
  registerEntry(input: RegisterEntryInput): Promise<ParkingSession>;
  registerExit(input: RegisterExitInput): Promise<ExitResult>;
  releaseSlot(slotId: string): Promise<void>;
}
