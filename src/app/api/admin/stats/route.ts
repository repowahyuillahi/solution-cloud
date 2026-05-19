/**
 * GET /api/admin/stats — Platform statistics
 *
 * Returns aggregate platform-wide statistics.
 * Access: Platform Owner only.
 *
 * @see Requirements 13.6
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireOwner } from '@/lib/rbac';
import { prismaMaster } from '@/lib/db-master';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { SessionData } from '@/types';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireOwner()(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  try {
    const tenants = await prismaMaster.tenant.findMany();

    const totalTenants = tenants.length;
    const activeSubscriptions = tenants.filter(
      (t) => t.subscriptionStatus === 'active' || t.subscriptionStatus === 'trial'
    ).length;

    // Trials expiring within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const trialsExpiringSoon = tenants.filter(
      (t) =>
        t.subscriptionStatus === 'trial' &&
        new Date(t.subscriptionExpiresAt) <= sevenDaysFromNow
    ).length;

    return NextResponse.json(
      {
        totalTenants,
        activeSubscriptions,
        trialsExpiringSoon,
        statusBreakdown: {
          trial: tenants.filter((t) => t.subscriptionStatus === 'trial').length,
          active: tenants.filter((t) => t.subscriptionStatus === 'active').length,
          expired: tenants.filter((t) => t.subscriptionStatus === 'expired').length,
          suspended: tenants.filter((t) => t.subscriptionStatus === 'suspended').length,
          archived: tenants.filter((t) => t.subscriptionStatus === 'archived').length,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error('[GET /api/admin/stats] Error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat memuat statistik.',
    );
  }
}
