import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { AUTH_GRPC_CLIENT } from '../../../core/ports/out/tokens';
import type {
  UserLookupPort,
  UserLookupResult,
} from '../../../core/ports/out/user-lookup.port';

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

  constructor(@Inject(AUTH_GRPC_CLIENT) private readonly grpc: ClientGrpc) {}

  onModuleInit(): void {
    this.client = this.grpc.getService<AuthServiceGrpc>('AuthService');
  }

  /** Cualquier fallo (NOT_FOUND, auth-service caido, etc.) se trata como "sin
   * datos": el llamador (CreateReservationUseCase) ya decide no publicar el
   * correo si no hay usuario, exactamente igual que con el UserRepositoryPort
   * de antes de la extraccion. */
  async findById(userId: string): Promise<UserLookupResult | null> {
    try {
      const reply = await firstValueFrom(this.client.getUserById({ userId }));
      return { id: reply.id, email: reply.email, fullName: reply.fullName };
    } catch {
      return null;
    }
  }
}
