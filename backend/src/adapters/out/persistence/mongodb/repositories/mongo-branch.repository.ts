import { Injectable } from '@nestjs/common';
import { Branch } from '../../../../../core/domain/entities/branch.entity';
import { BranchRepositoryPort } from '../../../../../core/ports/out/branch.repository.port';
import { MongoDbService } from '../mongo.service';
import { fromMongoDoc } from '../mongo-docs';

interface BranchDocument extends Record<string, unknown> {
  _id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  createdAt: Date;
}

@Injectable()
export class MongoBranchRepository implements BranchRepositoryPort {
  constructor(private readonly mongo: MongoDbService) {}

  private get collection() {
    return this.mongo.getCollection<BranchDocument>('branches');
  }

  async findById(id: string): Promise<Branch | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Branch[]> {
    const docs = await this.collection.find({}).sort({ name: 1 }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByIds(ids: string[]): Promise<Branch[]> {
    const docs = await this.collection.find({ _id: { $in: ids } }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findAllExcept(excludeBranchId: string): Promise<Branch[]> {
    const docs = await this.collection.find({ _id: { $ne: excludeBranchId } }).sort({ name: 1 }).toArray();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: BranchDocument): Branch {
    const record = fromMongoDoc<Branch>({
      _id: doc._id,
      name: doc.name,
      address: doc.address,
      lat: doc.lat,
      lng: doc.lng,
      pricePerHour: doc.pricePerHour,
      createdAt: doc.createdAt,
    } as Record<string, unknown>);
    return new Branch({
      id: record.id,
      name: record.name,
      address: record.address,
      lat: record.lat,
      lng: record.lng,
      pricePerHour: record.pricePerHour,
      createdAt: record.createdAt,
    });
  }
}
