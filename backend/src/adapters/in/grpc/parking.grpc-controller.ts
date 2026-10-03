import { Controller, Inject, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { GetSessionQuotePort } from '../../../core/ports/in/parking/get-session-quote.port';
import { GET_SESSION_QUOTE } from '../../../core/ports/in/tokens';
import { GrpcMetricsInterceptor } from '../../../observability/grpc-metrics.interceptor';
import { callUseCase } from './grpc-domain-error';

/** Entrada interna de backend para otros servicios (hoy: payments-service). */
@UseInterceptors(GrpcMetricsInterceptor)
@Controller()
export class ParkingGrpcController {
  constructor(
    @Inject(GET_SESSION_QUOTE)
    private readonly getSessionQuote: GetSessionQuotePort,
  ) {}

  @GrpcMethod('ParkingService', 'GetSessionQuote')
  quote(data: { sessionId: string }) {
    return callUseCase(() => this.getSessionQuote.execute(data.sessionId));
  }
}
