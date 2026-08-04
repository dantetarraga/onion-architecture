import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ParkingSlot } from '../../../../domain/entities/parking-slot.entity';
import { SlotStatus } from '../../../../domain/enums/slot-status.enum';
import { SlotType } from '../../../../domain/enums/slot-type.enum';
import {
  BranchOccupancySummary,
  ParkingSlotRepositoryPort,
  SlotAvailabilityCount,
} from '../../../../domain/ports/parking-slot.repository.port';
import { MongoDbService } from '../mongo.service';
import { fromMongoDoc, toMongoDoc } from '../mongo-docs';

interface ParkingSlotDocument extends Record<string, unknown> {
  _id: string;
  branchId: string;
  code: string;
  type: SlotType;
  status: SlotStatus;
  updatedAt: Date;
}

@Injectable()
export class MongoParkingSlotRepository implements ParkingSlotRepositoryPort {
  constructor(private readonly mongo: MongoDbService) {}

  private get collection() {
    return this.mongo.getCollection<ParkingSlotDocument>('parkingSlots');
  }

  async findById(id: string): Promise<ParkingSlot | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async countByBranchAndType(branchId: string): Promise<SlotAvailabilityCount[]> {
    const docs = await this.collection.find({ branchId }).toArray();
    const totals = docs.reduce<Record<SlotType, number>>((acc, doc) => {
      acc[doc.type] = (acc[doc.type] ?? 0) + 1;
      return acc;
    }, {} as Record<SlotType, number>);
    const available = docs.reduce<Record<SlotType, number>>((acc, doc) => {
      if (doc.status === SlotStatus.DISPONIBLE) {
        acc[doc.type] = (acc[doc.type] ?? 0) + 1;
      }
      return acc;
    }, {} as Record<SlotType, number>);

    return Object.entries(totals).map(([type, total]) => ({
      type: type as SlotType,
      total,
      available: available[type as SlotType] ?? 0,
    }));
  }

  async hasAvailability(branchId: string, type?: SlotType): Promise<boolean> {
    const count = await this.collection.countDocuments({
      branchId,
      status: SlotStatus.DISPONIBLE,
      ...(type ? { type } : {}),
    });
    return count > 0;
  }

  async claimAvailableSlot(branchId: string, type?: SlotType): Promise<ParkingSlot | null> {
    const result = await this.collection.findOneAndUpdate(
      { branchId, status: SlotStatus.DISPONIBLE, ...(type ? { type } : {}) },
      { $set: { status: SlotStatus.RESERVADA, updatedAt: new Date() } },
      { sort: { code: 1 }, returnDocument: 'after' },
    );
    return result ? this.toDomain(result as ParkingSlotDocument) : null;
  }

  async claimLeastRecentlyUsedSlot(branchId: string, type?: SlotType): Promise<ParkingSlot | null> {
    const result = await this.collection.findOneAndUpdate(
      { branchId, status: SlotStatus.DISPONIBLE, ...(type ? { type } : {}) },
      { $set: { status: SlotStatus.RESERVADA, updatedAt: new Date() } },
      { sort: { updatedAt: 1 }, returnDocument: 'after' },
    );
    return result ? this.toDomain(result as ParkingSlotDocument) : null;
  }

  async updateStatus(slotId: string, status: SlotStatus): Promise<void> {
    await this.collection.updateOne({ _id: slotId }, { $set: { status, updatedAt: new Date() } });
  }

  async getOccupancySummary(branchIds: string[]): Promise<BranchOccupancySummary[]> {
    const docs = await this.collection.find({ branchId: { $in: branchIds } }).toArray();
    const grouped = docs.reduce<Record<string, { total: number; occupiedOrReserved: number }>>((acc, doc) => {
      const entry = acc[doc.branchId] ?? { total: 0, occupiedOrReserved: 0 };
      entry.total += 1;
      if (doc.status === SlotStatus.OCUPADA || doc.status === SlotStatus.RESERVADA) {
        entry.occupiedOrReserved += 1;
      }
      acc[doc.branchId] = entry;
      return acc;
    }, {});

    return branchIds.map((branchId) => {
      const entry = grouped[branchId] ?? { total: 0, occupiedOrReserved: 0 };
      return { branchId, totalSlots: entry.total, occupiedOrReserved: entry.occupiedOrReserved };
    });
  }

  async markAllOccupied(branchId: string): Promise<void> {
    await this.collection.updateMany({ branchId, status: SlotStatus.DISPONIBLE }, { $set: { status: SlotStatus.OCUPADA, updatedAt: new Date() } });
  }

  private toDomain(doc: ParkingSlotDocument): ParkingSlot {
    const record = fromMongoDoc<ParkingSlot>({
      _id: doc._id,
      branchId: doc.branchId,
      code: doc.code,
      type: doc.type,
      status: doc.status,
      updatedAt: doc.updatedAt,
    } as Record<string, unknown>);

    return new ParkingSlot({
      id: record.id,
      branchId: record.branchId,
      code: record.code,
      type: record.type,
      status: record.status,
      updatedAt: record.updatedAt,
    });
  }
}
