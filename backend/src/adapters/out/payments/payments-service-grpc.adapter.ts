import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { Payment } from '../../../core/domain/entities/payment.entity';
import { PaymentStatus } from '../../../core/domain/enums/payment-status.enum';
import { PaymentServiceUnavailableError } from '../../../core/domain/errors/payment-service-unavailable.error';
import type {
  BranchRevenue,
  PaymentLookupPort,
} from '../../../core/ports/out/payment-lookup.port';
import { PAYMENTS_GRPC_CLIENT } from '../../../core/ports/out/tokens';

interface PaymentReply {
  id: string;
  sessionId: string;
  userId: string;
  branchId: string;
  amount: number;
  status: string;
  externalReference: string;
  paidAt: string;
  createdAt: string;
}

interface PaymentsServiceGrpc {
  getPaymentBySession(data: {
    sessionId: string;
  }): Observable<{ found: boolean; payment?: PaymentReply }>;
  sumApprovedByBranch(data: {
    branchIds: string[];
    from: string;
    to: string;
  }): Observable<{ rows?: BranchRevenue[] }>;
}

const RPC_TIMEOUT_MS = 5000;

function toDomain(reply: PaymentReply): Payment {
  return new Payment({
    id: reply.id,
    sessionId: reply.sessionId,
    userId: reply.userId,
    amount: reply.amount,
    status: reply.status as PaymentStatus,
    // proto3 no tiene null: los opcionales viajan como "".
    externalReference: reply.externalReference || null,
    paidAt: reply.paidAt ? new Date(reply.paidAt) : null,
    createdAt: new Date(reply.createdAt),
  });
}

/** Adaptador gRPC hacia payments-service (PaymentsService, ver proto/payments.proto). */
@Injectable()
export class PaymentsServiceGrpcAdapter implements PaymentLookupPort, OnModuleInit {
  private readonly logger = new Logger(PaymentsServiceGrpcAdapter.name);
  private client!: PaymentsServiceGrpc;

  constructor(@Inject(PAYMENTS_GRPC_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.client = this.grpc.getService<PaymentsServiceGrpc>('PaymentsService');
  }

  async findBySessionId(sessionId: string): Promise<Payment | null> {
    const reply = await this.call('GetPaymentBySession', () =>
      this.client.getPaymentBySession({ sessionId }),
    );
    return reply.found && reply.payment ? toDomain(reply.payment) : null;
  }

  async sumApprovedByBranch(
    branchIds: string[],
    from?: Date,
    to?: Date,
  ): Promise<BranchRevenue[]> {
    const reply = await this.call('SumApprovedByBranch', () =>
      this.client.sumApprovedByBranch({
        branchIds,
        from: from?.toISOString() ?? '',
        to: to?.toISOString() ?? '',
      }),
    );
    return reply.rows ?? [];
  }

  private async call<T>(rpc: string, request: () => Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request().pipe(timeout(RPC_TIMEOUT_MS)));
    } catch (error) {
      this.logger.error(
        `${rpc} fallo contra payments-service: ${(error as Error)?.message ?? String(error)}`,
      );
      throw new PaymentServiceUnavailableError();
    }
  }
}
