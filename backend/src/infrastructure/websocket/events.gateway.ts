import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { TokenPort } from '../../application/ports/token.port';
import { TOKEN_SERVICE } from '../../application/ports/tokens';
import { Role } from '../../domain/enums/role.enum';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true },
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.tokenService.verify(token);
      client.data.user = payload;
      if (payload.role === Role.ADMIN) {
        await client.join('admin');
      }
    } catch {
      this.logger.warn(`Conexion WebSocket rechazada: token invalido (${client.id})`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join:branch')
  handleJoinBranch(@ConnectedSocket() client: Socket, @MessageBody() data: { branchId: string }): void {
    void client.join(`branch:${data.branchId}`);
  }

  @SubscribeMessage('leave:branch')
  handleLeaveBranch(@ConnectedSocket() client: Socket, @MessageBody() data: { branchId: string }): void {
    void client.leave(`branch:${data.branchId}`);
  }
}
