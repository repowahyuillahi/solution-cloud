/**
 * GET /api/[slug]/dashboard — Get tenant dashboard stats
 *
 * Returns:
 *   - totalMachines: number of registered machines
 *   - totalEmployees: number of registered employees
 *   - lastDownload: most recent download history entry (or null)
 *
 * Access: Any authenticated role.
 *
 * @see Requirements 8.1, 8.2, 8.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { SessionData } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth check — any authenticated role
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD', 'Resepsionis'])(
    session.loginAt ? session : null,
  );
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.AUTH_NOT_AUTHENTICATED, 'Autentikasi diperlukan.');
  }

  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  try {
    const db = await getTenantDb(slug);

    // Get counts
    const [totalMachines, totalEmployees] = await Promise.all([
      db.machine.count(),
      db.employee.count(),
    ]);

    // Get most recent download history
    const lastDownload = await db.downloadHistory.findFirst({
      orderBy: { completedAt: 'desc' },
      include: { triggeredBy: { select: { username: true } } },
    });

    return NextResponse.json(
      {
        totalMachines,
        totalEmployees,
        lastDownload: lastDownload
          ? {
              id: lastDownload.id,
              totalMachines: lastDownload.totalMachines,
              successCount: lastDownload.successCount,
              failedCount: lastDownload.failedCount,
              totalLogs: lastDownload.totalLogs,
              startedAt: lastDownload.startedAt,
              completedAt: lastDownload.completedAt,
              triggeredBy: lastDownload.triggeredBy?.username ?? 'Unknown',
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/dashboard] Error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat memuat dashboard.',
    );
  }
}
