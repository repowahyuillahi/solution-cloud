/**
 * PUT    /api/[slug]/users/[id] — Update user password or role (Superadmin only)
 * DELETE /api/[slug]/users/[id] — Delete a user (Superadmin only)
 *
 * @see Requirements 2.3, 2.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { updateUserPasswordSchema, updateUserRoleSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

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

  if (typeof body !== 'object' || body === null) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Request body harus berupa objek JSON.',
    );
  }

  const rawBody = body as Record<string, unknown>;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID user tidak valid.');
  }

  // Validate fields: password and/or role
  const updateData: { passwordHash?: string; role?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if ('password' in rawBody) {
    const parsed = updateUserPasswordSchema.safeParse({ password: rawBody.password });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        firstIssue?.message ?? 'Validasi password gagal.',
        'password',
      );
    }
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  if ('role' in rawBody) {
    const parsed = updateUserRoleSchema.safeParse({ role: rawBody.role });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        firstIssue?.message ?? 'Validasi role gagal.',
        'role',
      );
    }
    updateData.role = parsed.data.role;
  }

  // Must have at least one field to update
  if (!updateData.passwordHash && !updateData.role) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Minimal satu field (password atau role) harus diisi.',
    );
  }

  try {
    const db = await getTenantDb(slug);

    // Check if user exists
    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return createErrorResponse(ErrorCode.NOT_FOUND_USER, 'User tidak ditemukan.');
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    console.error(`[PUT /api/${slug}/users/${id}] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID user tidak valid.');
  }

  try {
    const db = await getTenantDb(slug);

    // Check if user exists
    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return createErrorResponse(ErrorCode.NOT_FOUND_USER, 'User tidak ditemukan.');
    }

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ message: 'User berhasil dihapus.' }, { status: 200 });
  } catch (error: unknown) {
    console.error(`[DELETE /api/${slug}/users/${id}] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
