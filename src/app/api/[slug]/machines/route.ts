/**
 * GET  /api/[slug]/machines — List all machines (Superadmin only)
 * POST /api/[slug]/machines — Create a new machine (Superadmin only)
 *
 * @see Requirements 3.1, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createMachineSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
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
  // Verify tenant session ownership
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  try {
    const db = await getTenantDb(slug);
    const machines = await db.machine.findMany({
      select: {
        id: true,
        kodeDealer: true,
        namaDealer: true,
        serialNumber: true,
        connectionStatus: true,
        lastDownloadAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(machines, { status: 200 });
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/machines] Unexpected error:`, { error: error });
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

  // Validate with Zod schema
  const parsed = createMachineSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  const { kodeDealer, namaDealer, serialNumber, password } = parsed.data;

  try {
    const db = await getTenantDb(slug);

    const machine = await db.machine.create({
      data: {
        kodeDealer,
        namaDealer,
        serialNumber,
        password,
        updatedAt: new Date(),
      },
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

    return NextResponse.json(machine, { status: 201 });
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation (P2002)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const meta = (error as { meta?: { target?: string[] } }).meta;
      const target = meta?.target;

      if (target?.includes('serialNumber')) {
        return createErrorResponse(
          ErrorCode.CONFLICT_DUPLICATE_SERIAL_NUMBER,
          `Serial number '${serialNumber}' sudah digunakan.`,
          'serialNumber',
        );
      }

      if (target?.includes('kodeDealer')) {
        return createErrorResponse(
          ErrorCode.CONFLICT_DUPLICATE_SLUG,
          `Kode dealer '${kodeDealer}' sudah digunakan.`,
          'kodeDealer',
        );
      }

      // Fallback for unknown unique constraint
      return createErrorResponse(
        ErrorCode.CONFLICT_DUPLICATE_SERIAL_NUMBER,
        'Data duplikat terdeteksi.',
      );
    }

    logger.error(`[POST /api/${slug}/machines] Unexpected error:`, { error: error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
