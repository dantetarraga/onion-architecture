import { Injectable } from '@nestjs/common';
import { ParkingSlot as PrismaParkingSlot, Prisma } from '@prisma/client';
import { ParkingSlot } from '../../../../domain/entities/parking-slot.entity';
import { SlotStatus } from '../../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../../domain/enums/slot-type.enum';
import {
  BranchOccupancySummary,
  ParkingSlotRepositoryPort,
  SlotAvailabilityCount,
} from '../../../../domain/ports/parking-slot.repository.port';
import { ParkingSlotMapper } from '../mappers/parking-slot.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaParkingSlotRepository implements ParkingSlotRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ParkingSlot | null> {
    const record = await this.prisma.parkingSlot.findUnique({ where: { id } });
    return record ? ParkingSlotMapper.toDomain(record) : null;
  }

  async countByBranchAndType(branchId: string): Promise<SlotAvailabilityCount[]> {
    const totals = await this.prisma.parkingSlot.groupBy({
      by: ['type'],
      where: { branchId },
      _count: { _all: true },
    });
    const availables = await this.prisma.parkingSlot.groupBy({
      by: ['type'],
      where: { branchId, status: SlotStatus.DISPONIBLE },
      _count: { _all: true },
    });
    const availableMap = new Map(availables.map((row) => [row.type, row._count._all]));

    return totals.map((row) => ({
      type: row.type as unknown as SlotType,
      total: row._count._all,
      available: availableMap.get(row.type) ?? 0,
    }));
  }

  async hasAvailability(branchId: string, type?: SlotType): Promise<boolean> {
    const count = await this.prisma.parkingSlot.count({
      where: {
        branchId,
        status: SlotStatus.DISPONIBLE,
        ...(type ? { type } : {}),
      },
    });
    return count > 0;
  }

  /**
   * Reclama atomicamente la primera cochera DISPONIBLE usando
   * `FOR UPDATE SKIP LOCKED` dentro de un UPDATE...RETURNING, garantizando
   * que dos usuarios concurrentes nunca reciban la misma cochera (Politica 6).
   */
  async claimAvailableSlot(branchId: string, type?: SlotType): Promise<ParkingSlot | null> {
    const typeFilter = type ? Prisma.sql`AND "type" = ${type}::"SlotType"` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<PrismaParkingSlot[]>(Prisma.sql`
      UPDATE "parking_slots"
      SET "status" = 'RESERVADA', "updatedAt" = now()
      WHERE "id" = (
        SELECT "id" FROM "parking_slots"
        WHERE "branchId" = ${branchId} AND "status" = 'DISPONIBLE' ${typeFilter}
        ORDER BY "code" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *;
    `);

    const record = rows[0];
    return record ? ParkingSlotMapper.toDomain(record) : null;
  }

  async updateStatus(slotId: string, status: SlotStatus): Promise<void> {
    await this.prisma.parkingSlot.update({ where: { id: slotId }, data: { status } });
  }

  async getOccupancySummary(branchIds: string[]): Promise<BranchOccupancySummary[]> {
    const totals = await this.prisma.parkingSlot.groupBy({
      by: ['branchId'],
      where: { branchId: { in: branchIds } },
      _count: { _all: true },
    });
    const occupied = await this.prisma.parkingSlot.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: branchIds },
        status: { in: [SlotStatus.OCUPADA, SlotStatus.RESERVADA] },
      },
      _count: { _all: true },
    });
    const occupiedMap = new Map(occupied.map((row) => [row.branchId, row._count._all]));

    return totals.map((row) => ({
      branchId: row.branchId,
      totalSlots: row._count._all,
      occupiedOrReserved: occupiedMap.get(row.branchId) ?? 0,
    }));
  }

  async markAllOccupied(branchId: string): Promise<void> {
    await this.prisma.parkingSlot.updateMany({
      where: { branchId, status: SlotStatus.DISPONIBLE },
      data: { status: SlotStatus.OCUPADA },
    });
  }
}
