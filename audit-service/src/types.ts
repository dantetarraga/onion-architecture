export type AuditEventType =
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'payment.registered';

export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  occurredAt: string;
  aggregateId: string;
  actorUserId: string;
  payload: Record<string, unknown>;
}

export function isAuditEvent(value: unknown): value is AuditEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.eventId === 'string' &&
    typeof event.eventType === 'string' &&
    ['reservation.created', 'reservation.cancelled', 'payment.registered'].includes(
      event.eventType,
    ) &&
    typeof event.occurredAt === 'string' &&
    Number.isFinite(Date.parse(event.occurredAt)) &&
    typeof event.aggregateId === 'string' &&
    typeof event.actorUserId === 'string' &&
    !!event.payload &&
    typeof event.payload === 'object' &&
    !Array.isArray(event.payload)
  );
}