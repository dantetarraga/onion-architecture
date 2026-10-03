import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { ParkingServiceUnavailableError } from '../../../core/domain/errors/parking-service-unavailable.error';
import { RemoteDomainError } from '../../../core/domain/errors/remote-domain-error';
import type {
  SessionBillingPort,
  SessionQuote,
} from '../../../core/ports/out/session-billing.port';
import { PARKING_GRPC_CLIENT } from '../../../core/ports/out/tokens';
import { circuitBreakerMetrics } from '../../../observability/metrics';
import { CircuitBreaker } from '../resilience/circuit-breaker';

interface SessionQuoteReply {
  sessionId: string;
  userId: string;
  branchId: string;
  active: boolean;
  amount: number;
  currency: string;
  breakdown?: { label: string; amount: number }[];
}

interface ParkingServiceGrpc {
  getSessionQuote(data: { sessionId: string }): Observable<SessionQuoteReply>;
}

const RPC_TIMEOUT_MS = 5000;

/** Un error de dominio viaja como JSON `{code, message}` en `details` (ver adapters/in/grpc). */
function isDomainError(error: unknown): boolean {
  const details = (error as { details?: string } | undefined)?.details;
  if (!details) {
    return false;
  }
  try {
    return Boolean((JSON.parse(details) as { code?: string }).code);
  } catch {
    return false;
  }
}

/**
 * Cliente gRPC hacia backend (ParkingService, ver proto/parking.proto).
 * Si backend responde un error de dominio (p.ej. NOT_FOUND) viene como JSON
 * `{code, message}` en `details` (ver backend/src/adapters/in/grpc) y se
 * re-lanza con el mismo code; cualquier otro fallo (backend caido, timeout)
 * es ParkingServiceUnavailableError -> 503.
 */
@Injectable()
export class ParkingGrpcAdapter implements SessionBillingPort, OnModuleInit {
  private readonly logger = new Logger(ParkingGrpcAdapter.name);
  private client!: ParkingServiceGrpc;
  private readonly breaker = new CircuitBreaker({
    name: 'backend',
    isFailure: (error) => !isDomainError(error),
    ...circuitBreakerMetrics,
  });

  constructor(@Inject(PARKING_GRPC_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.client = this.grpc.getService<ParkingServiceGrpc>('ParkingService');
  }

  async getQuote(sessionId: string): Promise<SessionQuote> {
    try {
      const reply = await this.breaker.execute(() =>
        firstValueFrom(
          this.client.getSessionQuote({ sessionId }).pipe(timeout(RPC_TIMEOUT_MS)),
        ),
      );
      return {
        sessionId: reply.sessionId,
        userId: reply.userId,
        branchId: reply.branchId,
        active: reply.active,
        amount: reply.amount,
        currency: 'PEN',
        breakdown: reply.breakdown ?? [],
      };
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): Error {
    const details = (error as { details?: string } | undefined)?.details;
    if (details) {
      try {
        const parsed = JSON.parse(details) as { code?: string; message?: string };
        if (parsed.code) {
          return new RemoteDomainError(parsed.code, parsed.message ?? parsed.code);
        }
      } catch {
        // `details` no era JSON: error de transporte, no de dominio.
      }
    }
    this.logger.error(
      `GetSessionQuote fallo contra backend: ${(error as Error)?.message ?? String(error)}`,
    );
    return new ParkingServiceUnavailableError();
  }
}
