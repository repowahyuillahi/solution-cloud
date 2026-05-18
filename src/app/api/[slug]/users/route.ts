/**
 * GET  /api/[slug]/users — List all users (Superadmin only)
 * POST /api/[slug]/users — Create a new user (Superadmin only)
 *
 * @see Requirements 2.1, 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createUserSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  try {
    const db = await getTenantDb(slug);
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users, { status: 200 });
  } catch (error: unknown) {
    console.error(`[GET /api/${slug}/users] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
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
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  const { username, password, role } = parsed.data;

  try {
    const db = await getTenantDb(slug);

    // Hash password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        username,
        passwordHash,
        role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation (P2002)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return createErrorResponse(
        ErrorCode.CONFLICT_DUPLICATE_USERNAME,
        `Username '${username}' sudah digunakan.`,
        'username',
      );
    }

    console.error(`[POST /api/${slug}/users] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
