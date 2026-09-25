import { join } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentsServiceGrpcAdapter } from '../adapters/out/payments/payments-service-grpc.adapter';
import { PAYMENT_LOOKUP, PAYMENTS_GRPC_CLIENT } from '../core/ports/out/tokens';

/**
 * Cliente gRPC de backend hacia payments-service. Lo usan la salida de la
 * cochera (ParkingPolicy/RegisterExitUseCase: la sesion tiene que estar
 * pagada) y el reporte de ingresos del admin. Cobrar ya no es tarea de
 * backend: POST /payments entra por gateway directo a payments-service.
 */
@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: PAYMENTS_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: 'parking.payments.v1',
          protoPath: join(process.cwd(), 'proto', 'payments.proto'),
          url: process.env.PAYMENTS_SERVICE_GRPC_URL ?? 'localhost:50052',
        },
      },
    ]),
  ],
  providers: [{ provide: PAYMENT_LOOKUP, useClass: PaymentsServiceGrpcAdapter }],
  exports: [PAYMENT_LOOKUP],
})
export class PaymentsGrpcModule {}
