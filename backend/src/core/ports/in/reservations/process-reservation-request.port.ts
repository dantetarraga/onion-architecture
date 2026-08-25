import type { ReservationRequestMessage } from '../../out/reservation-request-queue.port';

export interface ProcessReservationRequestPort {
  execute(message: ReservationRequestMessage): Promise<void>;
}
