/**
 * PUT    /api/[slug]/machines/[id] — Update machine (Superadmin only)
 * DELETE /api/[slug]/machines/[id] — Delete a machine (Superadmin only)
 *
 * @see Requirements 3.3, 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
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
  // Verify tenant session ownership
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
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

  if (typeof body !== 'object' || body === null) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Request body harus berupa objek JSON.',
    );
  }

  const rawBody = body as Record<string, unknown>;
  const machineId = parseInt(id, 10);
  if (isNaN(machineId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID mesin tidak valid.');
  }

  // Build update data from allowed fields
  const updateData: { kodeDealer?: string; namaDealer?: string; password?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if ('kodeDealer' in rawBody) {
    const val = rawBody.kodeDealer;
    if (typeof val !== 'string' || val.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Field kodeDealer tidak boleh kosong.',
        'kodeDealer',
      );
    }
    updateData.kodeDealer = val.trim();
  }

  if ('namaDealer' in rawBody) {
    const val = rawBody.namaDealer;
    if (typeof val !== 'string' || val.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Field namaDealer tidak boleh kosong.',
        'namaDealer',
      );
    }
    updateData.namaDealer = val.trim();
  }

  if ('password' in rawBody) {
    const val = rawBody.password;
    if (typeof val !== 'string' || val.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Field password tidak boleh kosong.',
        'password',
      );
    }
    updateData.password = val.trim();
  }

  // Must have at least one field to update
  if (!updateData.kodeDealer && !updateData.namaDealer && !updateData.password) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Minimal satu field (kodeDealer, namaDealer, atau password) harus diisi.',
    );
  }

  try {
    const db = await getTenantDb(slug);

    // Check if machine exists
    const existing = await db.machine.findUnique({ where: { id: machineId } });
    if (!existing) {
      return createErrorResponse(ErrorCode.NOT_FOUND_MACHINE, 'Mesin tidak ditemukan.');
    }

    const updated = await db.machine.update({
      where: { id: machineId },
      data: updateData,
      select: {
        id: true,
        kodeDealer: true,
        namaDealer: true,
        serialNumber: true,
        connectionStatus: true,
        lastDownloadAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation (P2002) for kodeDealer updates
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const meta = (error as { meta?: { target?: string[] } }).meta;
      const target = meta?.target;

      if (target?.includes('kodeDealer')) {
        return createErrorResponse(
          ErrorCode.CONFLICT_DUPLICATE_SLUG,
          `Kode dealer '${updateData.kodeDealer}' sudah digunakan.`,
          'kodeDealer',
        );
      }

      return createErrorResponse(
        ErrorCode.CONFLICT_DUPLICATE_SERIAL_NUMBER,
        'Data duplikat terdeteksi.',
      );
    }

    logger.error(`[PUT /api/${slug}/machines/${id}] Unexpected error:`, { error: error });
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
  // Verify tenant session ownership
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  const machineId = parseInt(id, 10);
  if (isNaN(machineId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID mesin tidak valid.');
  }

  try {
    const db = await getTenantDb(slug);

    // Check if machine exists
    const existing = await db.machine.findUnique({ where: { id: machineId } });
    if (!existing) {
      return createErrorResponse(ErrorCode.NOT_FOUND_MACHINE, 'Mesin tidak ditemukan.');
    }

    await db.machine.delete({ where: { id: machineId } });

    return NextResponse.json({ message: 'Mesin berhasil dihapus.' }, { status: 200 });
  } catch (error: unknown) {
    logger.error(`[DELETE /api/${slug}/machines/${id}] Unexpected error:`, { error: error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
