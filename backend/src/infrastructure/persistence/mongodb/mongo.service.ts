import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Collection, Db, MongoClient } from 'mongodb';

@Injectable()
export class MongoDbService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri = this.config.get<string>('MONGODB_URI') ?? 'mongodb://127.0.0.1:27017/parking';
    const dbName = this.config.get<string>('MONGODB_DB') ?? 'parking';

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(dbName);

    await this.ensureSeedData();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }

  private async ensureSeedData(): Promise<void> {
    if (!this.db) {
      throw new Error('MongoDB connection has not been initialized');
    }

    const users = this.db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });

    const seedUsers = [
      {
        _id: 'user-admin-demo',
        email: 'admin@test.com',
        fullName: 'Admin Demo',
        role: 'ADMIN',
        password: 'Admin123!',
      },
      {
        _id: 'user-demo',
        email: 'user@test.com',
        fullName: 'User Demo',
        role: 'USER',
        password: 'User123!',
      },
    ];

    for (const user of seedUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await users.updateOne(
        { email: user.email },
        {
          $set: {
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            passwordHash,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    const branches = this.db.collection('branches');
    const branchCount = await branches.countDocuments({});

    if (branchCount === 0) {
      const seedBranches = [
        {
          _id: 'branch-1',
          name: 'Sucursal Centro',
          address: 'Av. Principal 123',
          lat: -12.0464,
          lng: -77.0428,
          pricePerHour: 5,
          createdAt: new Date(),
        },
        {
          _id: 'branch-2',
          name: 'Sucursal Sur',
          address: 'Calle Los Olivos 456',
          lat: -12.055,
          lng: -77.05,
          pricePerHour: 6,
          createdAt: new Date(),
        },
        {
          _id: 'branch-3',
          name: 'Sucursal Norte',
          address: 'Jr. Las Flores 789',
          lat: -12.03,
          lng: -77.03,
          pricePerHour: 4.5,
          createdAt: new Date(),
        },
      ];

      for (const branch of seedBranches) {
        await branches.updateOne(
          { _id: branch._id as never },
          {
            $setOnInsert: branch,
          },
          { upsert: true },
        );
      }
    }

    const parkingSlots = this.db.collection('parkingSlots');
    const slotCount = await parkingSlots.countDocuments({});

    if (slotCount === 0) {
      const seedSlots = [
        { _id: 'slot-branch1-1', branchId: 'branch-1', code: 'A1', type: 'REGULAR', status: 'DISPONIBLE', updatedAt: new Date() },
        { _id: 'slot-branch1-2', branchId: 'branch-1', code: 'A2', type: 'REGULAR', status: 'DISPONIBLE', updatedAt: new Date() },
        { _id: 'slot-branch1-3', branchId: 'branch-1', code: 'A3', type: 'DISCAPACIDAD', status: 'DISPONIBLE', updatedAt: new Date() },
        { _id: 'slot-branch2-1', branchId: 'branch-2', code: 'B1', type: 'REGULAR', status: 'DISPONIBLE', updatedAt: new Date() },
        { _id: 'slot-branch2-2', branchId: 'branch-2', code: 'B2', type: 'REGULAR', status: 'DISPONIBLE', updatedAt: new Date() },
        { _id: 'slot-branch3-1', branchId: 'branch-3', code: 'C1', type: 'REGULAR', status: 'DISPONIBLE', updatedAt: new Date() },
      ];

      for (const slot of seedSlots) {
        await parkingSlots.updateOne(
          { _id: slot._id as never },
          {
            $setOnInsert: slot,
          },
          { upsert: true },
        );
      }
    }

    if (branchCount === 0) {
      console.log('Seeded 3 demo branches and parking slots.');
    }

    console.log('Seeded demo users.');
  }

  getCollection<T extends Record<string, unknown>>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('MongoDB connection has not been initialized');
    }

    return this.db.collection<T>(name);
  }
}
