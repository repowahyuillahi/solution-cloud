/**
 * GET /api/portal/license — View license info
 * POST /api/portal/license — Regenerate license code
 *
 * Both endpoints require portal authentication (session.portalTenantId).
 *
 * @see Requirements 11.2, 11.3
 */

import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import { prismaMaster } from '@/lib/db-master';
import { regenerateLicenseCode } from '@/services/subscription-manager';

export async function GET(request: NextRequest) {
  // Check portal auth
  const session = await getSession(request);
  if (!session?.portalTenantId) {
    return createErrorResponse(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      'Anda harus login ke portal terlebih dahulu.',
    );
  }

  try {
    const tenant = await prismaMaster.tenant.findUnique({
      where: { id: session.portalTenantId },
    });

    if (!tenant) {
      return createErrorResponse(
        ErrorCode.TENANT_NOT_FOUND,
        'Tenant tidak ditemukan.',
      );
    }

    const now = new Date();
    const expiresAt = new Date(tenant.subscriptionExpiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      licenseCode: tenant.licenseCode,
      subscriptionStatus: tenant.subscriptionStatus,
      expiresAt: tenant.subscriptionExpiresAt,
      daysRemaining,
    });
  } catch (error: unknown) {
    logger.error('[GET /api/portal/license] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}

export async function POST(request: NextRequest) {
  // Check portal auth
  const session = await getSession(request);
  if (!session?.portalTenantId) {
    return createErrorResponse(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      'Anda harus login ke portal terlebih dahulu.',
    );
  }

  try {
    const newCode = await regenerateLicenseCode(session.portalTenantId);

    return NextResponse.json({ licenseCode: newCode });
  } catch (error: unknown) {
    logger.error('[POST /api/portal/license] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
