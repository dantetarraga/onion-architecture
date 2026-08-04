import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ParkingSession } from '../../../../domain/entities/parking-session.entity';
import { SessionStatus } from '../../../../domain/enums/session-status.enum';
import {
  CreateParkingSessionData,
  ParkingSessionRepositoryPort,
} from '../../../../domain/ports/parking-session.repository.port';
import { MongoDbService } from '../mongo.service';
import { fromMongoDoc } from '../mongo-docs';

interface ParkingSessionDocument extends Record<string, unknown> {
  _id: string;
  reservationId: string;
  userId: string;
  slotId: string;
  status: SessionStatus;
  entryAt: Date;
  exitAt: Date | null;
}

@Injectable()
export class MongoParkingSessionRepository implements ParkingSessionRepositoryPort {
  constructor(private readonly mongo: MongoDbService) {}

  private get collection() {
    return this.mongo.getCollection<ParkingSessionDocument>('parkingSessions');
  }

  async findById(id: string): Promise<ParkingSession | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async findActiveByUser(userId: string): Promise<ParkingSession | null> {
    const doc = await this.collection.findOne({ userId, status: SessionStatus.ACTIVE });
    return doc ? this.toDomain(doc) : null;
  }

  async findByReservationId(reservationId: string): Promise<ParkingSession | null> {
    const doc = await this.collection.findOne({ reservationId });
    return doc ? this.toDomain(doc) : null;
  }

  async create(data: CreateParkingSessionData): Promise<ParkingSession> {
    const doc: ParkingSessionDocument = {
      _id: randomUUID(),
      reservationId: data.reservationId,
      userId: data.userId,
      slotId: data.slotId,
      status: SessionStatus.ACTIVE,
      entryAt: data.entryAt,
      exitAt: null,
    };
    await this.collection.insertOne(doc);
    return this.toDomain(doc);
  }

  async markCompleted(id: string, exitAt: Date): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status: SessionStatus.COMPLETED, exitAt } });
  }

  async listByUser(userId: string): Promise<ParkingSession[]> {
    const docs = await this.collection.find({ userId }).sort({ entryAt: -1 }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: ParkingSessionDocument): ParkingSession {
    const record = fromMongoDoc<ParkingSession>({
      _id: doc._id,
      reservationId: doc.reservationId,
      userId: doc.userId,
      slotId: doc.slotId,
      status: doc.status,
      entryAt: doc.entryAt,
      exitAt: doc.exitAt,
    } as Record<string, unknown>);

    return new ParkingSession({
      id: record.id,
      reservationId: record.reservationId,
      userId: record.userId,
      slotId: record.slotId,
      status: record.status,
      entryAt: record.entryAt,
      exitAt: record.exitAt,
    });
  }
}
