import { Inject, Injectable, Logger } from '@nestjs/common';
import { computeOccupancyLevel } from '../../../core/application/shared/occupancy-level';
import { SlotStatus } from '../../../core/domain/enums/slot-status.enum';
import type { ParkingSlotRepositoryPort } from '../../../core/ports/out/parking-slot.repository.port';
import type {
  RealtimeNotifierPort,
  ReservationRequestResolvedPayload,
} from '../../../core/ports/out/realtime-notifier.port';
import { PARKING_SLOT_REPOSITORY } from '../../../core/ports/out/tokens';
import { RabbitMqConnection } from '../messaging/rabbitmq.connection';

/**
 * Contrato con realtime-service (copia en realtime-service/src/types.ts).
 * realtime-service no conoce el dominio: recibe el nombre del evento
 * socket.io, a quien va dirigido y el payload ya armado, y solo lo emite.
 *
 * - branch: sala `branch:<id>` + sala `admin`
 * - user:   sala `user:<id>` + sala `admin`
 * - admin:  solo sala `admin`
 */
export interface RealtimeEventEnvelope {
  event: string;
  target:
    | { type: 'branch'; branchId: string }
    | { type: 'user'; userId: string }
    | { type: 'admin' };
  payload: unknown;
}

/**
 * Unica implementacion de RealtimeNotifierPort desde la extraccion de
 * realtime-service, igual en el API y en el worker: nadie en backend tiene
 * sockets, todos publican en el exchange fanout `realtime.events` y
 * realtime-service (una o N instancias) lo reemite a los navegadores.
 *
 * Fire-and-forget como antes: si RabbitMQ no esta disponible se loguea y la
 * operacion de negocio (reserva, ingreso, salida) NO falla.
 */
@Injectable()
export class RabbitRealtimePublisherAdapter implements RealtimeNotifierPort {
  private readonly logger = new Logger(RabbitRealtimePublisherAdapter.name);

  constructor(
    private readonly connection: RabbitMqConnection,
    @Inject(PARKING_SLOT_REPOSITORY) private readonly slots: ParkingSlotRepositoryPort,
  ) {}

  notifyReservationCreated(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
    userId: string;
    expiresAt: Date;
  }): void {
    this.toBranch(payload.branchId, 'reservation.created', payload);
  }

  notifyReservationExpired(payload: { reservationId: string; branchId: string; slotId: string }): void {
    this.toBranch(payload.branchId, 'reservation.expired', payload);
  }

  notifyReservationCancelled(payload: { reservationId: string; branchId: string; slotId: string }): void {
    this.toBranch(payload.branchId, 'reservation.cancelled', payload);
  }

  notifySlotStatusChanged(payload: { branchId: string; slotId: string; status: SlotStatus }): void {
    this.toBranch(payload.branchId, 'slot.status.changed', payload);
  }

  notifyOccupancyUpdated(branchId: string): void {
    // realtime-service no tiene base de datos: la ocupacion se calcula aca,
    // donde estan las cocheras, y viaja ya resuelta en el payload.
    void this.slots
      .getOccupancySummary([branchId])
      .then(([summary]) => {
        const total = summary?.totalSlots ?? 0;
        const occupied = summary?.occupiedOrReserved ?? 0;
        this.toBranch(branchId, 'branch.occupancy.updated', {
          branchId,
          occupied,
          total,
          level: computeOccupancyLevel(occupied, total),
        });
      })
      .catch((error: Error) => {
        this.logger.error(`No se pudo calcular la ocupacion de ${branchId}: ${error.message}`);
      });
  }

  notifyEntryRegistered(payload: { sessionId: string; branchId: string; slotId: string; userId: string }): void {
    this.toBranch(payload.branchId, 'session.entry.registered', payload);
  }

  notifyExitRegistered(payload: { sessionId: string; branchId: string; slotId: string }): void {
    this.toBranch(payload.branchId, 'session.exit.registered', payload);
  }

  notifyReservationRequestResolved(payload: ReservationRequestResolvedPayload): void {
    // Va dirigido al navegador que envio la solicitud, no a la sucursal:
    // solo ese usuario espera este `requestId`.
    this.publish({
      event: 'reservation.request.resolved',
      target: { type: 'user', userId: payload.userId },
      payload,
    });
  }

  private toBranch(branchId: string, event: string, payload: unknown): void {
    this.publish({ event, target: { type: 'branch', branchId }, payload });
  }

  private publish(envelope: RealtimeEventEnvelope): void {
    void this.connection
      .getChannel()
      .then((channel) => {
        channel.publish(
          this.connection.topology.realtimeExchange,
          '',
          Buffer.from(JSON.stringify(envelope)),
          { contentType: 'application/json' },
        );
      })
      .catch((error: Error) => {
        this.logger.error(
          `No se pudo publicar el evento de tiempo real "${envelope.event}": ${error.message}`,
        );
      });
  }
}
