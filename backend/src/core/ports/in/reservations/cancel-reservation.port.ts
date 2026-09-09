import type { CancelReservationInput } from '../../../application/use-cases/reservations/cancel-reservation.use-case';

export interface CancelReservationPort {
  execute(input: CancelReservationInput): Promise<void>;
}
