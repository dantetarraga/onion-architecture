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

export interface AuditEventPublisherPort {
  publishAuditEvent(event: AuditEvent): Promise<void>;
}