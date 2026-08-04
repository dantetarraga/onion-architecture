import 'dotenv/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/parking';
const dbName = process.env.MONGODB_DB ?? 'parking';

interface SeedUser {
  _id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
}

interface SeedBranch {
  _id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  createdAt: Date;
}

async function main(): Promise<void> {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection<SeedUser>('users');

    await users.createIndex({ email: 1 }, { unique: true });

    const seedUsers: Array<{ _id: string; email: string; fullName: string; role: 'USER' | 'ADMIN'; password: string; createdAt: Date }> = [
      {
        _id: randomUUID(),
        email: 'admin@test.com',
        fullName: 'Admin Demo',
        role: 'ADMIN',
        password: 'Admin123!',
        createdAt: new Date(),
      },
      {
        _id: randomUUID(),
        email: 'user@test.com',
        fullName: 'User Demo',
        role: 'USER',
        password: 'User123!',
        createdAt: new Date(),
      },
    ];

    for (const user of seedUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await users.updateOne(
        { email: user.email },
        {
          $setOnInsert: {
            _id: user._id,
            email: user.email,
            passwordHash,
            fullName: user.fullName,
            role: user.role,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    const branches = db.collection<SeedBranch>('branches');
    const seedBranches: SeedBranch[] = [
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
        { _id: branch._id },
        {
          $setOnInsert: branch,
        },
        { upsert: true },
      );
    }

    console.log('Seeded demo users and branches.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
