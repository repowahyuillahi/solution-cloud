/**
 * POST /api/admin/tenants/[id]/activate — Activate or extend tenant subscription
 *
 * Body: { durationDays: number }
 *
 * Access: Platform Owner only.
 *
 * @see Requirements 13.4, 13.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireOwner } from '@/lib/rbac';
import { prismaMaster } from '@/lib/db-master';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

export async function POST(
  request: NextRequest,
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

  let body: { durationDays?: number };
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Body request tidak valid.');
  }

  const durationDays = body.durationDays ?? 30;
  if (durationDays < 1 || durationDays > 365) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Durasi harus antara 1-365 hari.',
      'durationDays',
    );
  }

  try {
    const tenant = await prismaMaster.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return createErrorResponse(ErrorCode.NOT_FOUND_TENANT, 'Tenant tidak ditemukan.');
    }

    // Calculate new expiry date
    const now = new Date();
    const currentExpiry = new Date(tenant.subscriptionExpiresAt);
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await prismaMaster.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'active',
        subscriptionExpiresAt: newExpiry,
      },
    });

    return NextResponse.json(
      {
        message: `Tenant "${tenant.companyName}" berhasil diaktifkan.`,
        newExpiresAt: newExpiry.toISOString(),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error(`[POST /api/admin/tenants/${id}/activate] Error:`, error);
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat mengaktifkan tenant.',
    );
  }
}
