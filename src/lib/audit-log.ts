/**
 * Audit log helper.
 *
 * Records sensitive admin actions to the AuditLog model in tenant DB.
 * Use for actions like user delete, suspension, configuration changes.
 */

import { getTenantDb } from '@/lib/db-tenant';
import { logger } from '@/lib/logger';

export interface AuditEntry {
  tenantSlug: string;
  actorId?: number | null;
  action: string; // e.g. "user.create", "user.delete", "settings.update"
  target?: string | null; // entity id or path
  details?: Record<string, unknown>;
}

/**
 * Record an audit entry. Failures are logged but never thrown — this should
 * never block the primary operation.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getTenantDb(entry.tenantSlug);
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  } catch (err) {
    logger.warn('Failed to record audit entry', {
      error: err,
      action: entry.action,
      tenant: entry.tenantSlug,
    });
  }
}
