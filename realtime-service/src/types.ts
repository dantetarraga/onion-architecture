/**
 * Contrato del exchange fanout `realtime.events` (RabbitMQ). Lo publican
 * backend (API y reservations-worker, ver
 * backend/src/adapters/out/realtime/rabbit-realtime-publisher.adapter.ts) y
 * payments-service (ver
 * payments-service/src/adapters/out/realtime/rabbit-payment-events.adapter.ts).
 *
 * Igual que notifications-service con su evento de Kafka, este servicio no
 * comparte codigo con los publicadores: solo este contrato. Tampoco conoce el
 * dominio: no sabe que es una reserva ni un pago, solo reenvia `event` +
 * `payload` a las salas que indica `target`.
 */
export type RealtimeTarget =
  | { type: 'branch'; branchId: string }
  | { type: 'user'; userId: string }
  | { type: 'admin' };

export interface RealtimeEventEnvelope {
  /** Nombre del evento socket.io que escucha el frontend (p.ej. `slot.status.changed`). */
  event: string;
  target: RealtimeTarget;
  payload: unknown;
}

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
}
