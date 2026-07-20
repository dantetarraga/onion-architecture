import { Payment as PrismaPayment } from '@prisma/client';
import { Payment } from '../../../../domain/entities/payment.entity';
import { PaymentStatus } from '../../../../domain/enums/payment-status.enum';

export class PaymentMapper {
  static toDomain(record: PrismaPayment): Payment {
    return new Payment({
      id: record.id,
      sessionId: record.sessionId,
      userId: record.userId,
      amount: record.amount.toNumber(),
      status: record.status as unknown as PaymentStatus,
      externalReference: record.externalReference,
      paidAt: record.paidAt,
      createdAt: record.createdAt,
    });
  }
}
