import { SlotStatus } from '../../domain/enums/slot-status.enum';

export interface RealtimeNotifierPort {
  notifyReservationCreated(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
    userId: string;
    expiresAt: Date;
  }): void;
  notifyReservationExpired(payload: { reservationId: string; branchId: string; slotId: string }): void;
  notifyReservationCancelled(payload: { reservationId: string; branchId: string; slotId: string }): void;
  notifySlotStatusChanged(payload: { branchId: string; slotId: string; status: SlotStatus }): void;
  notifyOccupancyUpdated(branchId: string): void;
  notifyEntryRegistered(payload: { sessionId: string; branchId: string; slotId: string; userId: string }): void;
  notifyExitRegistered(payload: { sessionId: string; branchId: string; slotId: string }): void;
  notifyPaymentRegistered(payload: {
    paymentId: string;
    sessionId: string;
    amount: number;
    status: string;
  }): void;
}
