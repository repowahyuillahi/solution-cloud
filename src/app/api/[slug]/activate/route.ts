/**
 * POST /api/[slug]/activate
 *
 * Public endpoint to activate a tenant's dashboard using a license code.
 * Verifies the code against the master DB and marks the tenant as activated.
 *
 * @see Requirements 10.5, 10.6
 */

import { NextRequest, NextResponse } from 'next/server';

import { activateLicenseSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { activateDashboard } from '@/services/registration';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

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

  // Validate with Zod schema
  const parsed = activateLicenseSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  const { licenseCode } = parsed.data;

  try {
    const activated = await activateDashboard(slug, licenseCode);

    if (!activated) {
      return createErrorResponse(
        ErrorCode.LICENSE_INVALID,
        'License code tidak valid atau tidak cocok dengan tenant ini.',
      );
    }

    return NextResponse.json({ activated: true }, { status: 200 });
  } catch (error: unknown) {
    console.error(`[POST /api/${slug}/activate] Unexpected error:`, error);
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
