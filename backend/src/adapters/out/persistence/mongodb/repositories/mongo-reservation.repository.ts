import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Reservation } from '../../../../../core/domain/entities/reservation.entity';
import { ReservationStatus } from '../../../../../core/domain/enums/reservation-status.enum';
import { SlotType } from '../../../../../core/domain/enums/slot-type.enum';
import {
  CreateReservationData,
  ReservationListFilters,
  ReservationRepositoryPort,
} from '../../../../../core/ports/out/reservation.repository.port';
import { MongoDbService } from '../mongo.service';
import { fromMongoDoc } from '../mongo-docs';

interface ReservationDocument extends Record<string, unknown> {
  _id: string;
  userId: string;
  branchId: string;
  slotId: string;
  requestedType: SlotType;
  status: ReservationStatus;
  createdAt: Date;
  startAt: Date;
  expiresAt: Date;
  confirmedAt: Date | null;
}

@Injectable()
export class MongoReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly mongo: MongoDbService) {}

  private get collection() {
    return this.mongo.getCollection<ReservationDocument>('reservations');
  }

  async findById(id: string): Promise<Reservation | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async findActiveByUser(userId: string): Promise<Reservation | null> {
    const doc = await this.collection.findOne({ userId, status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] } });
    return doc ? this.toDomain(doc) : null;
  }

  async findExpiredPending(now: Date): Promise<Reservation[]> {
    const docs = await this.collection.find({ status: ReservationStatus.PENDING, expiresAt: { $lt: now } }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  async create(data: CreateReservationData): Promise<Reservation> {
    const id = randomUUID();
    const now = new Date();
    const doc: ReservationDocument = {
      _id: id,
      userId: data.userId,
      branchId: data.branchId,
      slotId: data.slotId,
      requestedType: data.requestedType,
      status: ReservationStatus.PENDING,
      createdAt: now,
      startAt: data.startAt,
      expiresAt: data.expiresAt,
      confirmedAt: null,
    };
    await this.collection.insertOne(doc);
    return this.toDomain(doc);
  }

  async updateStatus(id: string, status: ReservationStatus, confirmedAt?: Date): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status, ...(confirmedAt ? { confirmedAt } : {}) } });
  }

  async listByUser(userId: string): Promise<Reservation[]> {
    const docs = await this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  async listByFilters(filters: ReservationListFilters): Promise<Reservation[]> {
    const query: Record<string, unknown> = {};
    if (filters.branchId) query.branchId = filters.branchId;
    if (filters.status) query.status = filters.status;

    const docs = await this.collection.find(query).sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: ReservationDocument): Reservation {
    const record = fromMongoDoc<Reservation>({
      _id: doc._id,
      userId: doc.userId,
      branchId: doc.branchId,
      slotId: doc.slotId,
      requestedType: doc.requestedType,
      status: doc.status,
      createdAt: doc.createdAt,
      startAt: doc.startAt,
      expiresAt: doc.expiresAt,
      confirmedAt: doc.confirmedAt,
    } as Record<string, unknown>);

    return new Reservation({
      id: record.id,
      userId: record.userId,
      branchId: record.branchId,
      slotId: record.slotId,
      requestedType: record.requestedType,
      status: record.status,
      createdAt: record.createdAt,
      startAt: record.startAt,
      expiresAt: record.expiresAt,
      confirmedAt: record.confirmedAt,
    });
  }
}
