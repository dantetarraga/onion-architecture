import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../../../../core/domain/entities/user.entity';
import { Role } from '../../../../../core/domain/enums/role.enum';
import { CreateUserData, UserRepositoryPort } from '../../../../../core/ports/out/user.repository.port';
import { MongoDbService } from '../mongo.service';
import { fromMongoDoc, toMongoDoc } from '../mongo-docs';

interface UserDocument extends Record<string, unknown> {
  _id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  createdAt: Date;
}

@Injectable()
export class MongoUserRepository implements UserRepositoryPort {
  constructor(private readonly mongo: MongoDbService) {}

  private get collection() {
    return this.mongo.getCollection<UserDocument>('users');
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.collection.findOne({ email });
    return doc ? this.toDomain(doc) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const id = randomUUID();
    const doc = toMongoDoc({
      id,
      email: data.email,
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      role: data.role,
      createdAt: new Date(),
    });

    await this.collection.insertOne(doc as unknown as UserDocument);
    return this.toDomain(doc as unknown as UserDocument);
  }

  private toDomain(doc: UserDocument): User {
    const record = fromMongoDoc<User>({
      _id: doc._id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      fullName: doc.fullName,
      role: doc.role,
      createdAt: doc.createdAt,
    } as Record<string, unknown>);
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      fullName: record.fullName,
      role: record.role,
      createdAt: record.createdAt,
    });
  }
}
