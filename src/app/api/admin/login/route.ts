/**
 * POST /api/admin/login — Platform owner login
 *
 * Body: { username: string, password: string }
 *
 * @see Requirements 13.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';

import { sessionOptions } from '@/lib/auth';
import { prismaMaster } from '@/lib/db-master';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp, resetRateLimit } from '@/lib/rate-limit';
import type { SessionData } from '@/types';

const LOGIN_RATE_LIMIT = { max: 10, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  // Rate limit per IP
  const ip = getClientIp(request.headers);
  const rateKey = `admin-login:${ip}`;
  const rl = checkRateLimit(rateKey, LOGIN_RATE_LIMIT);
  if (!rl.allowed) {
    return createErrorResponse(
      ErrorCode.RATE_LIMIT_ACCOUNT_LOCKED,
      `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(rl.retryAfterMs / 1000)} detik.`,
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Body request tidak valid.');
  }

  const { username, password } = body;
  if (!username || !password) {
    return createErrorResponse(
      ErrorCode.VALIDATION_EMPTY_FIELD,
      'Username dan password wajib diisi.',
    );
  }

  try {
    const owner = await prismaMaster.platformOwner.findUnique({
      where: { username },
    });

    if (!owner) {
      return createErrorResponse(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Username atau password salah.',
      );
    }

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) {
      return createErrorResponse(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Username atau password salah.',
      );
    }

    // Create session
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.isOwner = true;
    session.loginAt = Date.now();
    await session.save();

    // Reset rate limit on successful login
    resetRateLimit(rateKey);

    return NextResponse.json(
      { message: 'Login berhasil.', isOwner: true },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error('[POST /api/admin/login] Error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
