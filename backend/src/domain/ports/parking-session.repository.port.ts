import { ParkingSession } from '../entities/parking-session.entity';

export interface CreateParkingSessionData {
  reservationId: string;
  userId: string;
  slotId: string;
  entryAt: Date;
}

export interface ParkingSessionRepositoryPort {
  findById(id: string): Promise<ParkingSession | null>;
  findActiveByUser(userId: string): Promise<ParkingSession | null>;
  findByReservationId(reservationId: string): Promise<ParkingSession | null>;
  create(data: CreateParkingSessionData): Promise<ParkingSession>;
  markCompleted(id: string, exitAt: Date): Promise<void>;
  listByUser(userId: string): Promise<ParkingSession[]>;
}
