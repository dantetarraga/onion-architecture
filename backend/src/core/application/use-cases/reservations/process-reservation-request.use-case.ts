import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../domain/errors/domain-error';
import type { CreateReservationPort } from '../../../ports/in/reservations/create-reservation.port';
import { CREATE_RESERVATION } from '../../../ports/in/tokens';
import type { ProcessReservationRequestPort } from '../../../ports/in/reservations/process-reservation-request.port';
import type { ReservationRequestMessage } from '../../../ports/out/reservation-request-queue.port';
import type {
  RealtimeNotifierPort,
  ReservationRequestResolvedPayload,
} from '../../../ports/out/realtime-notifier.port';
import { REALTIME_NOTIFIER } from '../../../ports/out/tokens';

/**
 * Lado consumidor de la cola: toma una solicitud encolada, la ejecuta con
 * el caso de uso de siempre y devuelve el desenlace al usuario que la
 * origino a traves del puerto de tiempo real.
 *
 * Distingue dos clases de fallo, y esa distincion es la que decide si el
 * mensaje se reintenta:
 *
 * - `DomainError` (RESERVATION_ALREADY_ACTIVE, NO_AVAILABILITY, ...) es una
 *   respuesta de negocio, no un fallo: se notifica como REJECTED y se
 *   retorna normal para que el consumidor haga `ack`. Reintentarlo daria
 *   el mismo resultado para siempre.
 * - Cualquier otro error (base de datos caida, bug) se relanza para que el
 *   consumidor haga `nack(requeue: false)` y el mensaje termine en la DLQ,
 *   donde queda visible para inspeccion en vez de perderse.
 */
@Injectable()
export class ProcessReservationRequestUseCase
  implements ProcessReservationRequestPort
{
  constructor(
    @Inject(CREATE_RESERVATION)
    private readonly createReservation: CreateReservationPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(message: ReservationRequestMessage): Promise<void> {
    let resolution: ReservationRequestResolvedPayload;

    try {
      const result = await this.createReservation.execute({
        userId: message.userId,
        branchId: message.branchId,
        slotType: message.slotType,
        startAt: message.startAt,
      });

      resolution =
        result.outcome === 'CREATED'
          ? {
              requestId: message.requestId,
              userId: message.userId,
              status: 'CREATED',
              reservation: {
                id: result.reservation.id,
                branchId: result.reservation.branchId,
                slotId: result.reservation.slotId,
                startAt: result.reservation.startAt,
                expiresAt: result.reservation.expiresAt,
              },
            }
          : {
              requestId: message.requestId,
              userId: message.userId,
              status: 'SUGGEST_OTHER_BRANCH',
              suggestedBranch: {
                id: result.suggestedBranch.id,
                name: result.suggestedBranch.name,
                address: result.suggestedBranch.address,
              },
              distanceKm: result.distanceKm,
            };
    } catch (error) {
      if (!(error instanceof DomainError)) {
        throw error;
      }

      resolution = {
        requestId: message.requestId,
        userId: message.userId,
        status: 'REJECTED',
        code: error.code,
        message: error.message,
      };
    }

    this.notifier.notifyReservationRequestResolved(resolution);
  }
}
