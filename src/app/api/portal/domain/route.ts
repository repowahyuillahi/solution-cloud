/**
 * GET /api/portal/domain — View custom domain settings
 * POST /api/portal/domain — Set custom domain
 *
 * Both endpoints require portal authentication (session.portalTenantId).
 *
 * @see Requirements 15.1, 15.2
 */

import { NextRequest, NextResponse } from 'next/server';

import { customDomainSchema } from '@/lib/validation';
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
      currentSlug: tenant.slug,
      customDomain: tenant.customDomain,
      dnsInstructions: tenant.customDomain
        ? `Tambahkan CNAME record: ${tenant.customDomain} → wflab.web.id`
        : null,
    });
  } catch (error: unknown) {
    logger.error('[GET /api/portal/domain] Unexpected error:', { error: error });
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

  // Validate with customDomainSchema
  const parsed = customDomainSchema.safeParse(body);
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
    // Check if domain is already taken by another tenant
    const existingDomain = await prismaMaster.tenant.findUnique({
      where: { customDomain: parsed.data.domain },
    });

    if (existingDomain && existingDomain.id !== session.portalTenantId) {
      return createErrorResponse(
        ErrorCode.CONFLICT_DUPLICATE_SLUG,
        'Domain sudah digunakan oleh tenant lain.',
        'domain',
      );
    }

    // Update tenant custom domain
    const tenant = await prismaMaster.tenant.update({
      where: { id: session.portalTenantId },
      data: { customDomain: parsed.data.domain },
    });

    return NextResponse.json({
      currentSlug: tenant.slug,
      customDomain: tenant.customDomain,
      dnsInstructions: `Tambahkan CNAME record: ${tenant.customDomain} → wflab.web.id`,
    });
  } catch (error: unknown) {
    logger.error('[POST /api/portal/domain] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
