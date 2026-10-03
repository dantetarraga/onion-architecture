import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding auth-service database...');

  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('User123!', 10);

  await prisma.user.create({
    data: {
      email: 'admin@parking.com',
      passwordHash: adminPasswordHash,
      fullName: 'Administrador General',
      role: Role.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: 'user@parking.com',
      passwordHash: userPasswordHash,
      fullName: 'Usuario Demo',
      role: Role.USER,
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
