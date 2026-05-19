/**
 * GET /api/[slug]/download/status — Check bulk download status
 *
 * Returns whether a bulk download is currently in progress for this tenant,
 * plus the most recent download history entry if available.
 *
 * Access: Superadmin, HRD only.
 *
 * @see Requirements 5.7, 5.9
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { isDownloadInProgress } from '@/services/attendance-downloader';
import type { SessionData } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth & RBAC check — Superadmin or HRD
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  // Verify session belongs to this tenant
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  try {
    const inProgress = isDownloadInProgress(slug);

    // Get the most recent download history
    const db = await getTenantDb(slug);
    const lastDownload = await db.downloadHistory.findFirst({
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        totalMachines: true,
        successCount: true,
        failedCount: true,
        totalLogs: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json(
      {
        inProgress,
        lastDownload: lastDownload
          ? {
              id: lastDownload.id,
              totalMachines: lastDownload.totalMachines,
              successCount: lastDownload.successCount,
              failedCount: lastDownload.failedCount,
              totalLogs: lastDownload.totalLogs,
              startedAt: lastDownload.startedAt,
              completedAt: lastDownload.completedAt,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/download/status] Unexpected error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
