import { Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';

export interface CreateReservationData {
  userId: string;
  branchId: string;
  slotId: string;
  requestedType: import('../enums/slot-type.enum').SlotType;
  expiresAt: Date;
}

export interface ReservationListFilters {
  branchId?: string;
  status?: ReservationStatus;
}

export interface ReservationRepositoryPort {
  findById(id: string): Promise<Reservation | null>;
  findActiveByUser(userId: string): Promise<Reservation | null>;
  findExpiredPending(now: Date): Promise<Reservation[]>;
  create(data: CreateReservationData): Promise<Reservation>;
  updateStatus(id: string, status: ReservationStatus, confirmedAt?: Date): Promise<void>;
  listByUser(userId: string): Promise<Reservation[]>;
  listByFilters(filters: ReservationListFilters): Promise<Reservation[]>;
}
