/**
 * GET  /api/[slug]/employees — List employees (with optional branch filter)
 * POST /api/[slug]/employees — Create a new employee
 *
 * @see Requirements 4.1, 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createEmployeeSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  try {
    const db = await getTenantDb(slug);

    // Optional branch filter
    const kodeDealer = request.nextUrl.searchParams.get('kodeDealer');

    const employees = await db.employee.findMany({
      where: kodeDealer
        ? { branchAssignments: { some: { kodeDealer } } }
        : undefined,
      select: {
        id: true,
        kodeKaryawan: true,
        namaKaryawan: true,
        branchAssignments: {
          select: {
            kodeDealer: true,
          },
        },
      },
      orderBy: { kodeKaryawan: 'asc' },
    });

    return NextResponse.json(employees, { status: 200 });
  } catch (error: unknown) {
    console.error(`[GET /api/${slug}/employees] Unexpected error:`, error);
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
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
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
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  const { kodeKaryawan, namaKaryawan, branches } = parsed.data;

  try {
    const db = await getTenantDb(slug);

    const employee = await db.employee.create({
      data: {
        kodeKaryawan,
        namaKaryawan,
        updatedAt: new Date(),
        branchAssignments: {
          create: branches.map((kodeDealer) => ({ kodeDealer })),
        },
      },
      select: {
        id: true,
        kodeKaryawan: true,
        namaKaryawan: true,
        branchAssignments: {
          select: {
            kodeDealer: true,
          },
        },
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation (P2002)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return createErrorResponse(
        ErrorCode.CONFLICT_DUPLICATE_KODE_KARYAWAN,
        `Kode karyawan '${kodeKaryawan}' sudah digunakan.`,
        'kodeKaryawan',
      );
    }

    console.error(`[POST /api/${slug}/employees] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
