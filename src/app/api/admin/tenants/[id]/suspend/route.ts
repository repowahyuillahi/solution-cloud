/**
 * POST /api/admin/tenants/[id]/suspend — Suspend a tenant
 *
 * Access: Platform Owner only.
 *
 * @see Requirements 13.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireOwner } from '@/lib/rbac';
import { prismaMaster } from '@/lib/db-master';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
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

    await prismaMaster.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'suspended' },
    });

    return NextResponse.json(
      { message: `Tenant "${tenant.companyName}" berhasil di-suspend.` },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[POST /api/admin/tenants/${id}/suspend] Error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat men-suspend tenant.',
    );
  }
}
