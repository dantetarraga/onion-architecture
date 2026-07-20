import { Injectable } from '@nestjs/common';
import { ParkingSession } from '../../../../domain/entities/parking-session.entity';
import { SessionStatus } from '../../../../domain/enums/session-status.enum';
import {
  CreateParkingSessionData,
  ParkingSessionRepositoryPort,
} from '../../../../domain/ports/parking-session.repository.port';
import { ParkingSessionMapper } from '../mappers/parking-session.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaParkingSessionRepository implements ParkingSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ParkingSession | null> {
    const record = await this.prisma.parkingSession.findUnique({ where: { id } });
    return record ? ParkingSessionMapper.toDomain(record) : null;
  }

  async findActiveByUser(userId: string): Promise<ParkingSession | null> {
    const record = await this.prisma.parkingSession.findFirst({
      where: { userId, status: SessionStatus.ACTIVE },
    });
    return record ? ParkingSessionMapper.toDomain(record) : null;
  }

  async findByReservationId(reservationId: string): Promise<ParkingSession | null> {
    const record = await this.prisma.parkingSession.findUnique({ where: { reservationId } });
    return record ? ParkingSessionMapper.toDomain(record) : null;
  }

  async create(data: CreateParkingSessionData): Promise<ParkingSession> {
    const record = await this.prisma.parkingSession.create({
      data: {
        reservationId: data.reservationId,
        userId: data.userId,
        slotId: data.slotId,
        entryAt: data.entryAt,
      },
    });
    return ParkingSessionMapper.toDomain(record);
  }

  async markCompleted(id: string, exitAt: Date): Promise<void> {
    await this.prisma.parkingSession.update({
      where: { id },
      data: { status: SessionStatus.COMPLETED, exitAt },
    });
  }

  async listByUser(userId: string): Promise<ParkingSession[]> {
    const records = await this.prisma.parkingSession.findMany({
      where: { userId },
      orderBy: { entryAt: 'desc' },
    });
    return records.map(ParkingSessionMapper.toDomain);
  }
}
