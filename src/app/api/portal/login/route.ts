/**
 * POST /api/portal/login
 *
 * Public endpoint for customer portal login. Validates credentials
 * against the master database tenant record (adminEmail + adminPasswordHash).
 * On success, creates an iron-session with portalTenantId and portalEmail.
 *
 * @see Requirements 11.1
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { loginSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { createSession } from '@/lib/auth';
import { prismaMaster } from '@/lib/db-master';
import type { SessionData } from '@/types';

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

  // Validate with loginSchema (username field used as email)
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  const { username, password } = parsed.data;

  try {
    // Find tenant by adminEmail in master DB (username field carries the email)
    const tenant = await prismaMaster.tenant.findUnique({
      where: { adminEmail: username },
    });

    if (!tenant) {
      return createErrorResponse(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Email atau password salah.',
      );
    }

    // Verify password with bcrypt
    const valid = await bcrypt.compare(password, tenant.adminPasswordHash);
    if (!valid) {
      return createErrorResponse(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Email atau password salah.',
      );
    }

    // Create session with portalTenantId and portalEmail
    const sessionData: SessionData = {
      portalTenantId: tenant.id,
      portalEmail: tenant.adminEmail,
      loginAt: Date.now(),
    };

    const response = NextResponse.json(
      {
        tenantId: tenant.id,
        slug: tenant.slug,
        companyName: tenant.companyName,
      },
      { status: 200 },
    );

    await createSession(response, sessionData);

    return response;
  } catch (error: unknown) {
    console.error('[POST /api/portal/login] Unexpected error:', error);
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
