import { Injectable } from '@nestjs/common';
import { Reservation } from '../../../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../../../domain/enums/reservation-status.enum';
import {
  CreateReservationData,
  ReservationListFilters,
  ReservationRepositoryPort,
} from '../../../../domain/ports/reservation.repository.port';
import { ReservationMapper } from '../mappers/reservation.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Reservation | null> {
    const record = await this.prisma.reservation.findUnique({ where: { id } });
    return record ? ReservationMapper.toDomain(record) : null;
  }

  async findActiveByUser(userId: string): Promise<Reservation | null> {
    const record = await this.prisma.reservation.findFirst({
      where: {
        userId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      },
    });
    return record ? ReservationMapper.toDomain(record) : null;
  }

  async findExpiredPending(now: Date): Promise<Reservation[]> {
    const records = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        expiresAt: { lt: now },
      },
    });
    return records.map(ReservationMapper.toDomain);
  }

  async create(data: CreateReservationData): Promise<Reservation> {
    const record = await this.prisma.reservation.create({
      data: {
        userId: data.userId,
        branchId: data.branchId,
        slotId: data.slotId,
        requestedType: data.requestedType,
        expiresAt: data.expiresAt,
      },
    });
    return ReservationMapper.toDomain(record);
  }

  async updateStatus(id: string, status: ReservationStatus, confirmedAt?: Date): Promise<void> {
    await this.prisma.reservation.update({
      where: { id },
      data: { status, ...(confirmedAt ? { confirmedAt } : {}) },
    });
  }

  async listByUser(userId: string): Promise<Reservation[]> {
    const records = await this.prisma.reservation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(ReservationMapper.toDomain);
  }

  async listByFilters(filters: ReservationListFilters): Promise<Reservation[]> {
    const records = await this.prisma.reservation.findMany({
      where: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(ReservationMapper.toDomain);
  }
}
