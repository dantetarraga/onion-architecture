import { Pool } from 'pg';
import type { AuditEvent } from './types';

export interface AuditRecord extends AuditEvent {}

export class AuditStore {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        aggregate_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit_events (occurred_at DESC)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS audit_events_type_occurred_at_idx ON audit_events (event_type, occurred_at DESC)',
    );
  }

  async append(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (event_id, event_type, occurred_at, aggregate_id, actor_user_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId,
        event.eventType,
        event.occurredAt,
        event.aggregateId,
        event.actorUserId,
        JSON.stringify(event.payload),
      ],
    );
  }

  async list(limit: number, eventType?: string): Promise<AuditRecord[]> {
    const result = eventType
      ? await this.pool.query(
          `SELECT event_id AS "eventId", event_type AS "eventType", occurred_at AS "occurredAt",
                  aggregate_id AS "aggregateId", actor_user_id AS "actorUserId", payload
           FROM audit_events WHERE event_type = $1 ORDER BY occurred_at DESC LIMIT $2`,
          [eventType, limit],
        )
      : await this.pool.query(
          `SELECT event_id AS "eventId", event_type AS "eventType", occurred_at AS "occurredAt",
                  aggregate_id AS "aggregateId", actor_user_id AS "actorUserId", payload
           FROM audit_events ORDER BY occurred_at DESC LIMIT $1`,
          [limit],
        );
    return result.rows as AuditRecord[];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}