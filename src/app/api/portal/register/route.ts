/**
 * POST /api/portal/register
 *
 * Public endpoint for new tenant registration. Validates input,
 * creates the tenant record, provisions the database, and returns
 * the license code needed for dashboard activation.
 *
 * @see Requirements 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8
 */

import { NextRequest, NextResponse } from 'next/server';

import { registrationSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { register, RegistrationError } from '@/services/registration';
import type { RegistrationResult } from '@/types';

export async function POST(request: NextRequest) {
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
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  // Call registration service
  try {
    const result: RegistrationResult = await register(parsed.data);

    return NextResponse.json(
      {
        tenantId: result.tenantId,
        slug: result.slug,
        licenseCode: result.licenseCode,
        trialExpiresAt: result.trialExpiresAt,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof RegistrationError) {
      switch (error.code) {
        case 'SLUG_DUPLICATE':
          return createErrorResponse(
            ErrorCode.CONFLICT_DUPLICATE_SLUG,
            error.message,
            'companySlug',
          );
        case 'EMAIL_DUPLICATE':
          return createErrorResponse(
            ErrorCode.CONFLICT_DUPLICATE_EMAIL,
            error.message,
            'adminEmail',
          );
        case 'SLUG_RESERVED':
        case 'SLUG_INVALID':
          return createErrorResponse(
            ErrorCode.VALIDATION_INVALID_FORMAT,
            error.message,
            'companySlug',
          );
        default:
          return createErrorResponse(
            ErrorCode.SERVER_INTERNAL_ERROR,
            'Terjadi kesalahan saat registrasi.',
          );
      }
    }

    // Unexpected error
    logger.error('[POST /api/portal/register] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
