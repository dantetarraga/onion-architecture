import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { AUTH_GRPC_CLIENT } from '../../../core/ports/out/tokens';
import type {
  UserLookupPort,
  UserLookupResult,
} from '../../../core/ports/out/user-lookup.port';
import { circuitBreakerMetrics } from '../../../observability/metrics';
import { CircuitBreaker } from '../resilience/circuit-breaker';

const RPC_TIMEOUT_MS = 3000;

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

interface UserReply {
  id: string;
  email: string;
  fullName: string;
}

interface AuthServiceGrpc {
  getUserById(data: { userId: string }): Observable<UserReply>;
}

/** Adaptador gRPC hacia auth-service, usado solo por el unico caso de uso de
 * negocio (CreateReservationUseCase) que necesita email/fullName reales para
 * el evento de confirmacion por correo — no para validar tokens por request. */
@Injectable()
export class AuthServiceGrpcAdapter implements UserLookupPort, OnModuleInit {
  private client!: AuthServiceGrpc;
  private readonly breaker = new CircuitBreaker({
    name: 'auth-service',
    isFailure: (error) => !isDomainError(error),
    ...circuitBreakerMetrics,
  });

  constructor(@Inject(AUTH_GRPC_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.client = this.grpc.getService<AuthServiceGrpc>('AuthService');
  }

  /** Cualquier fallo (NOT_FOUND, auth-service caido, etc.) se trata como "sin
   * datos": el llamador (CreateReservationUseCase) ya decide no publicar el
   * correo si no hay usuario, exactamente igual que con el UserRepositoryPort
   * de antes de la extraccion. Con auth-service caido el circuito se abre y
   * el worker deja de esperar el timeout en cada reserva. */
  async findById(userId: string): Promise<UserLookupResult | null> {
    try {
      const reply = await this.breaker.execute(() =>
        firstValueFrom(
          this.client.getUserById({ userId }).pipe(timeout(RPC_TIMEOUT_MS)),
        ),
      );
      return { id: reply.id, email: reply.email, fullName: reply.fullName };
    } catch {
      return null;
    }
  }
}
