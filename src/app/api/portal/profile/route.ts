/**
 * GET /api/portal/profile — View company profile
 * PUT /api/portal/profile — Update company profile
 *
 * Both endpoints require portal authentication (session.portalTenantId).
 *
 * @see Requirements 14.9, 14.10
 */

import { NextRequest, NextResponse } from 'next/server';

import { companyProfileSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import { prismaMaster } from '@/lib/db-master';

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

    return NextResponse.json({
      companyName: tenant.companyName,
      logoUrl: tenant.logoUrl,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      address: tenant.address,
    });
  } catch (error: unknown) {
    logger.error('[GET /api/portal/profile] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}

export async function PUT(request: NextRequest) {
  // Check portal auth
  const session = await getSession(request);
  if (!session?.portalTenantId) {
    return createErrorResponse(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      'Anda harus login ke portal terlebih dahulu.',
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Request body harus berupa JSON yang valid.',
    );
  }

  // Validate with companyProfileSchema
  const parsed = companyProfileSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  try {
    const updateData: Record<string, string> = {};
    if (parsed.data.companyName !== undefined) updateData.companyName = parsed.data.companyName;
    if (parsed.data.contactEmail !== undefined) updateData.contactEmail = parsed.data.contactEmail;
    if (parsed.data.contactPhone !== undefined) updateData.contactPhone = parsed.data.contactPhone;
    if (parsed.data.address !== undefined) updateData.address = parsed.data.address;

    const tenant = await prismaMaster.tenant.update({
      where: { id: session.portalTenantId },
      data: updateData,
    });

    return NextResponse.json({
      companyName: tenant.companyName,
      logoUrl: tenant.logoUrl,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      address: tenant.address,
    });
  } catch (error: unknown) {
    logger.error('[PUT /api/portal/profile] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
