import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SlotType } from '../../../domain/enums/slot-type.enum';
import { ReservationQueueUnavailableError } from '../../../domain/errors/reservation-queue-unavailable.error';
import type { ClockPort } from '../../../ports/out/clock.port';
import type { ReservationRequestQueuePort } from '../../../ports/out/reservation-request-queue.port';
import { CLOCK, RESERVATION_REQUEST_QUEUE } from '../../../ports/out/tokens';
import type { RequestReservationPort } from '../../../ports/in/reservations/request-reservation.port';

export interface RequestReservationInput {
  userId: string;
  branchId: string;
  slotType?: SlotType;
  startAt?: Date;
}

export interface RequestReservationResult {
  requestId: string;
  status: 'QUEUED';
}

/**
 * Encola la solicitud de reserva y devuelve de inmediato el `requestId`.
 * No decide nada de negocio: la asignacion de cochera, las politicas y la
 * escritura en base de datos ocurren despues, en el worker, dentro de
 * `CreateReservationUseCase` (que no cambio ni una linea).
 *
 * Si la cola no acepta el mensaje se lanza `ReservationQueueUnavailableError`:
 * sin cola la reserva nunca se creara, asi que no aplica el criterio de
 * "efecto secundario tolerante a fallos" que usa el publisher de Kafka.
 */
@Injectable()
export class RequestReservationUseCase implements RequestReservationPort {
  constructor(
    @Inject(RESERVATION_REQUEST_QUEUE)
    private readonly queue: ReservationRequestQueuePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    input: RequestReservationInput,
  ): Promise<RequestReservationResult> {
    const requestId = randomUUID();

    try {
      await this.queue.enqueue({
        requestId,
        userId: input.userId,
        branchId: input.branchId,
        slotType: input.slotType,
        startAt: input.startAt,
        requestedAt: this.clock.now(),
      });
    } catch {
      throw new ReservationQueueUnavailableError();
    }

    return { requestId, status: 'QUEUED' };
  }
}
