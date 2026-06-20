/**
 * audit.ts — audit trail (PRD §3, §11).
 *
 * Every create/edit/delete on customers, bookings, costs, schedule, payments and
 * loans must be logged with the acting user, atomically with the mutation. The
 * Neon HTTP driver has no interactive transactions, so callers use `db.batch([...])`
 * to run the mutation and the audit insert as a single atomic transaction:
 *
 *   await db.batch([
 *     db.insert(customers).values(row).returning(),
 *     db.insert(auditLog).values(auditEntry({ ... })),
 *   ]);
 *
 * `auditEntry` returns the insert values (it does not touch the DB itself), and
 * scrubs any Aadhaar/PAN-like field down to the last 4 before storing.
 */
import { auditLog } from "@/db/schema";
import type { AuditAction, AuditEntity } from "@/lib/permissions";
import { maskSensitive } from "./masking";

type AuditInsert = typeof auditLog.$inferInsert;

export interface AuditEntryParams {
  userId: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
}

/** Recursively reduce any aadhaar/pan-named string field to a masked form. */
export function scrubSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(scrubSensitive);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/aadhaar|pan/i.test(k) && typeof v === "string") {
        out[k] = maskSensitive(v);
      } else {
        out[k] = scrubSensitive(v);
      }
    }
    return out;
  }
  // bigint is not JSON-serialisable — store as string in the audit JSON.
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function auditEntry(params: AuditEntryParams): AuditInsert {
  return {
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeJson: params.before === undefined ? null : scrubSensitive(params.before),
    afterJson: params.after === undefined ? null : scrubSensitive(params.after),
  };
}
