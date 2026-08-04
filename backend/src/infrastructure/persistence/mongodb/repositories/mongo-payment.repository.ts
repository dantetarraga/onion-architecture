import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Payment } from '../../../../domain/entities/payment.entity';
import { PaymentStatus } from '../../../../domain/enums/payment-status.enum';
import { CreatePaymentData, PaymentRepositoryPort } from '../../../../domain/ports/payment.repository.port';
import { MongoDbService } from '../mongo.service';
import { fromMongoDoc } from '../mongo-docs';

interface PaymentDocument extends Record<string, unknown> {
  _id: string;
  sessionId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  externalReference: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class MongoPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly mongo: MongoDbService) {}

  private get collection() {
    return this.mongo.getCollection<PaymentDocument>('payments');
  }

  async findById(id: string): Promise<Payment | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async findBySessionId(sessionId: string): Promise<Payment | null> {
    const doc = await this.collection.findOne({ sessionId });
    return doc ? this.toDomain(doc) : null;
  }

  async create(data: CreatePaymentData): Promise<Payment> {
    const doc: PaymentDocument = {
      _id: randomUUID(),
      sessionId: data.sessionId,
      userId: data.userId,
      amount: data.amount,
      status: data.status,
      externalReference: data.externalReference,
      paidAt: data.paidAt,
      createdAt: new Date(),
    };
    await this.collection.insertOne(doc);
    return this.toDomain(doc);
  }

  async increaseAmount(id: string, additionalAmount: number, externalReference: string, paidAt: Date): Promise<Payment> {
    const existing = await this.collection.findOne({ _id: id });
    if (!existing) {
      throw new Error(`Payment ${id} not found`);
    }

    const updated = await this.collection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          amount: existing.amount + additionalAmount,
          status: PaymentStatus.APPROVED,
          externalReference: existing.externalReference ? `${existing.externalReference},${externalReference}` : externalReference,
          paidAt,
        },
      },
      { returnDocument: 'after' },
    );
    return this.toDomain(updated as PaymentDocument);
  }

  async listByUser(userId: string): Promise<Payment[]> {
    const docs = await this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  async sumApprovedAmountByBranch(branchId: string, from?: Date, to?: Date): Promise<number> {
    const query: Record<string, unknown> = { status: PaymentStatus.APPROVED };
    if (from || to) {
      query.createdAt = {} as Record<string, unknown>;
      if (from) (query.createdAt as Record<string, Date>).$gte = from;
      if (to) (query.createdAt as Record<string, Date>).$lte = to;
    }

    const docs = await this.collection.find(query).toArray();
    let total = 0;

    for (const doc of docs) {
      const session = await this.mongo.getCollection<{ _id: string; reservationId: string }>('parkingSessions').findOne({ _id: doc.sessionId });
      if (!session) {
        continue;
      }
      const reservation = await this.mongo.getCollection<{ _id: string; branchId: string }>('reservations').findOne({ _id: session.reservationId });
      if (reservation?.branchId === branchId) {
        total += doc.amount;
      }
    }

    return total;
  }

  private toDomain(doc: PaymentDocument): Payment {
    const record = fromMongoDoc<Payment>({
      _id: doc._id,
      sessionId: doc.sessionId,
      userId: doc.userId,
      amount: doc.amount,
      status: doc.status,
      externalReference: doc.externalReference,
      paidAt: doc.paidAt,
      createdAt: doc.createdAt,
    } as Record<string, unknown>);

    return new Payment({
      id: record.id,
      sessionId: record.sessionId,
      userId: record.userId,
      amount: record.amount,
      status: record.status,
      externalReference: record.externalReference,
      paidAt: record.paidAt,
      createdAt: record.createdAt,
    });
  }
}
