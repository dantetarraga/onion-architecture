import type {
  CreateReservationInput,
  CreateReservationResult,
} from '../../../application/use-cases/reservations/create-reservation.use-case';

export interface CreateReservationPort {
  execute(input: CreateReservationInput): Promise<CreateReservationResult>;
}
