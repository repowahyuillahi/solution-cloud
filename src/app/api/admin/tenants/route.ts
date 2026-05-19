/**
 * GET /api/admin/tenants — List all tenants
 *
 * Returns all tenants with summary info.
 * Access: Platform Owner only.
 *
 * @see Requirements 13.1, 13.2
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
  // Auth check — Platform Owner only
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireOwner()(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  try {
    const tenants = await prismaMaster.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        slug: true,
        adminEmail: true,
        subscriptionStatus: true,
        trialStartedAt: true,
        subscriptionExpiresAt: true,
        isActivated: true,
        lastActivityAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(tenants, { status: 200 });
  } catch (error: unknown) {
    logger.error('[GET /api/admin/tenants] Error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat memuat data tenant.',
    );
  }
}
