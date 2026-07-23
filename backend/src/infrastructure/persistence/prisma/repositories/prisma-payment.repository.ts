import { Injectable } from '@nestjs/common';
import { Payment } from '../../../../domain/entities/payment.entity';
import { PaymentStatus } from '../../../../domain/enums/payment-status.enum';
import { CreatePaymentData, PaymentRepositoryPort } from '../../../../domain/ports/payment.repository.port';
import { PaymentMapper } from '../mappers/payment.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { id } });
    return record ? PaymentMapper.toDomain(record) : null;
  }

  async findBySessionId(sessionId: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { sessionId } });
    return record ? PaymentMapper.toDomain(record) : null;
  }

  async create(data: CreatePaymentData): Promise<Payment> {
    const record = await this.prisma.payment.create({
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        amount: data.amount,
        status: data.status,
        externalReference: data.externalReference,
        paidAt: data.paidAt,
      },
    });
    return PaymentMapper.toDomain(record);
  }

  async increaseAmount(
    id: string,
    additionalAmount: number,
    externalReference: string,
    paidAt: Date,
  ): Promise<Payment> {
    const existing = await this.prisma.payment.findUniqueOrThrow({ where: { id } });
    const record = await this.prisma.payment.update({
      where: { id },
      data: {
        amount: existing.amount.toNumber() + additionalAmount,
        status: PaymentStatus.APPROVED,
        externalReference: existing.externalReference
          ? `${existing.externalReference},${externalReference}`
          : externalReference,
        paidAt,
      },
    });
    return PaymentMapper.toDomain(record);
  }

  async listByUser(userId: string): Promise<Payment[]> {
    const records = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(PaymentMapper.toDomain);
  }

  async sumApprovedAmountByBranch(branchId: string, from?: Date, to?: Date): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.APPROVED,
        session: {
          slot: { branchId },
        },
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
    });
    return result._sum.amount?.toNumber() ?? 0;
  }
}
