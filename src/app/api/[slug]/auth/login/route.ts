/**
 * POST /api/[slug]/auth/login
 *
 * Public endpoint for tenant user login. Validates credentials,
 * checks account lock status, and creates an iron-session cookie
 * with tenant context on success.
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { loginSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp, resetRateLimit } from '@/lib/rate-limit';
import { loginTenantUser, isAccountLocked, sessionOptions } from '@/lib/auth';
import type { SessionData } from '@/types';

const LOGIN_RATE_LIMIT = { max: 10, windowMs: 60_000 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Rate limit per IP per tenant
  const ip = getClientIp(request.headers);
  const rateKey = `tenant-login:${slug}:${ip}`;
  const rl = checkRateLimit(rateKey, LOGIN_RATE_LIMIT);
  if (!rl.allowed) {
    return createErrorResponse(
      ErrorCode.RATE_LIMIT_ACCOUNT_LOCKED,
      `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(rl.retryAfterMs / 1000)} detik.`,
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

  // Validate with Zod schema
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
    // Attempt login
    const sessionData = await loginTenantUser(slug, username, password);

    if (!sessionData) {
      // Check if account is locked
      const locked = await isAccountLocked(slug, username);
      if (locked) {
        return createErrorResponse(
          ErrorCode.RATE_LIMIT_ACCOUNT_LOCKED,
          'Akun terkunci karena terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
        );
      }

      return createErrorResponse(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Username atau password salah.',
      );
    }

    // Create session with tenant context
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    session.tenantSlug = sessionData.tenantSlug;
    session.userId = sessionData.userId;
    session.username = sessionData.username;
    session.role = sessionData.role;
    session.loginAt = sessionData.loginAt;

    await session.save();

    // Reset rate limit on successful login
    resetRateLimit(rateKey);

    return NextResponse.json(
      {
        userId: sessionData.userId,
        username: sessionData.username,
        role: sessionData.role,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[POST /api/${slug}/auth/login] Unexpected error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
