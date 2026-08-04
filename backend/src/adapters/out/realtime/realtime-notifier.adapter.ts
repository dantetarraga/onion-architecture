import { Inject, Injectable } from '@nestjs/common';
import { RealtimeNotifierPort } from '../../../core/ports/out/realtime-notifier.port';
import { computeOccupancyLevel } from '../../../core/application/shared/occupancy-level';
import { SlotStatus } from '../../../core/domain/enums/slot-status.enum';
import type { ParkingSlotRepositoryPort } from '../../../core/ports/out/parking-slot.repository.port';
import { PARKING_SLOT_REPOSITORY } from '../../../core/ports/out/tokens';
import { EventsGateway } from '../../in/websocket/events.gateway';

@Injectable()
export class RealtimeNotifierAdapter implements RealtimeNotifierPort {
  constructor(
    private readonly gateway: EventsGateway,
    @Inject(PARKING_SLOT_REPOSITORY) private readonly slots: ParkingSlotRepositoryPort,
  ) {}

  notifyReservationCreated(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
    userId: string;
    expiresAt: Date;
  }): void {
    this.emitToBranch(payload.branchId, 'reservation.created', payload);
  }

  notifyReservationExpired(payload: { reservationId: string; branchId: string; slotId: string }): void {
    this.emitToBranch(payload.branchId, 'reservation.expired', payload);
  }

  notifyReservationCancelled(payload: { reservationId: string; branchId: string; slotId: string }): void {
    this.emitToBranch(payload.branchId, 'reservation.cancelled', payload);
  }

  notifySlotStatusChanged(payload: { branchId: string; slotId: string; status: SlotStatus }): void {
    this.emitToBranch(payload.branchId, 'slot.status.changed', payload);
  }

  notifyOccupancyUpdated(branchId: string): void {
    void this.broadcastOccupancy(branchId);
  }

  notifyEntryRegistered(payload: { sessionId: string; branchId: string; slotId: string; userId: string }): void {
    this.emitToBranch(payload.branchId, 'session.entry.registered', payload);
  }

  notifyExitRegistered(payload: { sessionId: string; branchId: string; slotId: string }): void {
    this.emitToBranch(payload.branchId, 'session.exit.registered', payload);
  }

  notifyPaymentRegistered(payload: { paymentId: string; sessionId: string; amount: number; status: string }): void {
    this.gateway.server.to('admin').emit('payment.registered', payload);
  }

  private emitToBranch(branchId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`branch:${branchId}`).emit(event, payload);
    this.gateway.server.to('admin').emit(event, payload);
  }

  private async broadcastOccupancy(branchId: string): Promise<void> {
    const [summary] = await this.slots.getOccupancySummary([branchId]);
    const total = summary?.totalSlots ?? 0;
    const occupied = summary?.occupiedOrReserved ?? 0;

    this.emitToBranch(branchId, 'branch.occupancy.updated', {
      branchId,
      occupied,
      total,
      level: computeOccupancyLevel(occupied, total),
    });
  }
}
