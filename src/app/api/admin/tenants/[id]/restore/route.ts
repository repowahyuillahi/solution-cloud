/**
 * POST /api/admin/tenants/[id]/restore — Restore an archived tenant
 *
 * Access: Platform Owner only.
 *
 * @see Requirements 13.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireOwner } from '@/lib/rbac';
import { prismaMaster } from '@/lib/db-master';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { restoreTenantFiles } from '@/services/file-storage';
import type { SessionData } from '@/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tenantId = parseInt(id, 10);

  if (isNaN(tenantId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID tenant tidak valid.');
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireOwner()(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  try {
    const tenant = await prismaMaster.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return createErrorResponse(ErrorCode.NOT_FOUND_TENANT, 'Tenant tidak ditemukan.');
    }

    if (tenant.subscriptionStatus !== 'archived') {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Hanya tenant dengan status "archived" yang dapat di-restore.',
      );
    }

    // Restore files
    try {
      await restoreTenantFiles(tenant.slug);
    } catch {
      // Files may not exist, continue anyway
    }

    // Reactivate with 30-day subscription
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prismaMaster.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'active',
        subscriptionExpiresAt: newExpiry,
      },
    });

    return NextResponse.json(
      {
        message: `Tenant "${tenant.companyName}" berhasil di-restore.`,
        newExpiresAt: newExpiry.toISOString(),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[POST /api/admin/tenants/${id}/restore] Error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat me-restore tenant.',
    );
  }
}
