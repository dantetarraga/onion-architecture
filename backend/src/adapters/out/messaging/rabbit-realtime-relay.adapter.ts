import { Injectable, Logger } from '@nestjs/common';
import { SlotStatus } from '../../../core/domain/enums/slot-status.enum';
import type {
  RealtimeNotifierPort,
  ReservationRequestResolvedPayload,
} from '../../../core/ports/out/realtime-notifier.port';
import { RabbitMqConnection } from './rabbitmq.connection';

export interface RealtimeRelayEnvelope {
  method: keyof RealtimeNotifierPort;
  args: unknown[];
}

@Injectable()
export class RabbitRealtimeRelayAdapter implements RealtimeNotifierPort {
  private readonly logger = new Logger(RabbitRealtimeRelayAdapter.name);

  constructor(private readonly connection: RabbitMqConnection) {}

  notifyReservationCreated(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
    userId: string;
    expiresAt: Date;
  }): void {
    this.relay('notifyReservationCreated', payload);
  }

  notifyReservationExpired(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
  }): void {
    this.relay('notifyReservationExpired', payload);
  }

  notifyReservationCancelled(payload: {
    reservationId: string;
    branchId: string;
    slotId: string;
  }): void {
    this.relay('notifyReservationCancelled', payload);
  }

  notifySlotStatusChanged(payload: {
    branchId: string;
    slotId: string;
    status: SlotStatus;
  }): void {
    this.relay('notifySlotStatusChanged', payload);
  }

  notifyOccupancyUpdated(branchId: string): void {
    this.relay('notifyOccupancyUpdated', branchId);
  }

  notifyEntryRegistered(payload: {
    sessionId: string;
    branchId: string;
    slotId: string;
    userId: string;
  }): void {
    this.relay('notifyEntryRegistered', payload);
  }

  notifyExitRegistered(payload: {
    sessionId: string;
    branchId: string;
    slotId: string;
  }): void {
    this.relay('notifyExitRegistered', payload);
  }

  notifyPaymentRegistered(payload: {
    paymentId: string;
    sessionId: string;
    amount: number;
    status: string;
  }): void {
    this.relay('notifyPaymentRegistered', payload);
  }

  notifyReservationRequestResolved(
    payload: ReservationRequestResolvedPayload,
  ): void {
    this.relay('notifyReservationRequestResolved', payload);
  }

  private relay(method: keyof RealtimeNotifierPort, ...args: unknown[]): void {
    const envelope: RealtimeRelayEnvelope = { method, args };

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
          `No se pudo reenviar el evento de tiempo real "${String(method)}": ${error.message}`,
        );
      });
  }
}
