import { db } from '../db';
import { auditLogs } from '@shared/schema';

export type AuditEvent = string;

/**
 * Insert an audit log entry. Fire-and-forget; never throws so it
 * cannot break the caller's flow.
 */
export async function logAuditEvent(
  userId: string,
  event: AuditEvent,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId,
      event,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error('[audit-log] Failed to write audit event:', event, err);
  }
}
