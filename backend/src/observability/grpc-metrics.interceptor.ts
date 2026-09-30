import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, tap } from 'rxjs';
import { grpcServerDuration } from './metrics';

/**
 * Se aplica con `@UseInterceptors` en cada controller gRPC y no como
 * interceptor global: para heredar config global el microservicio necesitaria
 * `inheritAppConfig`, que tambien le colgaria los filtros HTTP.
 *
 * `grpc_status`: OK, DOMAIN_ERROR (un DomainError traducido a RpcException
 * por `callUseCase`, es decir, un rechazo de negocio esperado) o ERROR.
 */
@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }
    const end = grpcServerDuration.startTimer({
      grpc_method: `${context.getClass().name}.${context.getHandler().name}`,
    });
    return next.handle().pipe(
      tap({
        complete: () => end({ grpc_status: 'OK' }),
        error: (error: unknown) =>
          end({
            grpc_status: error instanceof RpcException ? 'DOMAIN_ERROR' : 'ERROR',
          }),
      }),
    );
  }
}
