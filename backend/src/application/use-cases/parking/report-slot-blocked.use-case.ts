import { Inject, Injectable } from '@nestjs/common';
import { SlotStatus } from '../../../domain/enums/slot-status.enum';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { ParkingSlotRepositoryPort } from '../../../domain/ports/parking-slot.repository.port';
import { PARKING_SLOT_REPOSITORY } from '../../../domain/ports/tokens';
import type { RealtimeNotifierPort } from '../../ports/realtime-notifier.port';
import { REALTIME_NOTIFIER } from '../../ports/tokens';

@Injectable()
export class ReportSlotBlockedUseCase {
  constructor(
    @Inject(PARKING_SLOT_REPOSITORY) private readonly slots: ParkingSlotRepositoryPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(slotId: string): Promise<void> {
    const slot = await this.slots.findById(slotId);
    if (!slot) {
      throw new NotFoundError('ParkingSlot', slotId);
    }

    await this.slots.updateStatus(slotId, SlotStatus.NO_DISPONIBLE);
    this.notifier.notifySlotStatusChanged({ branchId: slot.branchId, slotId, status: SlotStatus.NO_DISPONIBLE });
    this.notifier.notifyOccupancyUpdated(slot.branchId);
  }
}
