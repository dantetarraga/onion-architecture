import 'dotenv/config';
import { PrismaClient, Role, SlotType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface BranchSeed {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  slots: { type: SlotType; count: number }[];
}

const branches: BranchSeed[] = [
  {
    name: 'Sucursal San Isidro',
    address: 'Av. Javier Prado 123, San Isidro, Lima',
    lat: -12.0931,
    lng: -77.0465,
    pricePerHour: 5,
    slots: [
      { type: SlotType.REGULAR, count: 6 },
      { type: SlotType.MOTO, count: 3 },
      { type: SlotType.ELECTRICO, count: 2 },
      { type: SlotType.DISCAPACITADOS, count: 1 },
    ],
  },
  {
    name: 'Sucursal Miraflores',
    address: 'Av. Larco 456, Miraflores, Lima',
    lat: -12.1219,
    lng: -77.0297,
    pricePerHour: 6,
    slots: [
      { type: SlotType.REGULAR, count: 4 },
      { type: SlotType.MOTO, count: 2 },
      { type: SlotType.ELECTRICO, count: 1 },
      { type: SlotType.DISCAPACITADOS, count: 1 },
    ],
  },
  {
    name: 'Sucursal San Borja',
    address: 'Av. Aviacion 789, San Borja, Lima',
    lat: -12.1019,
    lng: -76.9998,
    pricePerHour: 4.5,
    slots: [
      { type: SlotType.REGULAR, count: 5 },
      { type: SlotType.MOTO, count: 3 },
      { type: SlotType.ELECTRICO, count: 1 },
      { type: SlotType.DISCAPACITADOS, count: 1 },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  await prisma.payment.deleteMany();
  await prisma.parkingSession.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.parkingSlot.deleteMany();
  await prisma.branch.deleteMany();
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

  for (const branchSeed of branches) {
    const branch = await prisma.branch.create({
      data: {
        name: branchSeed.name,
        address: branchSeed.address,
        lat: branchSeed.lat,
        lng: branchSeed.lng,
        pricePerHour: branchSeed.pricePerHour,
      },
    });

    for (const slotGroup of branchSeed.slots) {
      const prefix = slotGroup.type.slice(0, 3);
      for (let i = 1; i <= slotGroup.count; i++) {
        await prisma.parkingSlot.create({
          data: {
            branchId: branch.id,
            code: `${prefix}-${String(i).padStart(2, '0')}`,
            type: slotGroup.type,
          },
        });
      }
    }
  }

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
