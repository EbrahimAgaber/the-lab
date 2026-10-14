import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';

export interface AuditContext {
  actorId: string;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
}

export interface OutboxEntry {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export class AuditService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  logAudit(ctx: AuditContext, entry: AuditEntry): void {
    const id = this.ids.next();
    const now = this.clock.now().toISOString();
    const diffJson = entry.diff ? JSON.stringify(entry.diff) : null;

    this.db
      .prepare(
        `INSERT INTO sys_audit_log (id, actor_id, action, entity_type, entity_id, diff_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, ctx.actorId, entry.action, entry.entityType, entry.entityId, diffJson, now);
  }

  emitOutbox(entry: OutboxEntry): void {
    const id = this.ids.next();
    const now = this.clock.now().toISOString();
    const key = entry.idempotencyKey ?? id;

    this.db
      .prepare(
        `INSERT INTO sys_outbox (id, event_name, event_version, aggregate_type, aggregate_id, payload_json, idempotency_key, occurred_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
      )
      .run(id, entry.eventName, entry.aggregateType, entry.aggregateId, JSON.stringify(entry.payload), key, now);
  }
}
