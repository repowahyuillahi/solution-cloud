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
import type { SessionData } from '@/types';

export async function POST(request: NextRequest) {
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

    return NextResponse.json(
      { message: 'Login berhasil.', isOwner: true },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error('[POST /api/admin/login] Error:', error);
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
