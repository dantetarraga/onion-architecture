import type {
  RequestReservationInput,
  RequestReservationResult,
} from '../../../application/use-cases/reservations/request-reservation.use-case';

export interface RequestReservationPort {
  execute(input: RequestReservationInput): Promise<RequestReservationResult>;
}
