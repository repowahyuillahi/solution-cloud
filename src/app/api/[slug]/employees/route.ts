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
import { logger } from '@/lib/logger';
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
  // Verify tenant session ownership
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  try {
    const db = await getTenantDb(slug);

    const params = request.nextUrl.searchParams;
    const kodeDealer = params.get('kodeDealer');
    const search = params.get('search');
    const pageRaw = params.get('page');
    const pageSizeRaw = params.get('pageSize');

    // Pagination is opt-in: when no page params are provided, return all rows
    // (preserves backward compatibility with existing UI).
    const paginated = pageRaw !== null || pageSizeRaw !== null;
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw ?? '50', 10) || 50));

    const where: Record<string, unknown> = {};
    if (kodeDealer) {
      where.branchAssignments = { some: { kodeDealer } };
    }
    if (search) {
      where.OR = [
        { kodeKaryawan: { contains: search } },
        { namaKaryawan: { contains: search } },
      ];
    }

    const findArgs = {
      where,
      select: {
        id: true,
        kodeKaryawan: true,
        namaKaryawan: true,
        branchAssignments: {
          select: { kodeDealer: true },
        },
      },
      orderBy: { kodeKaryawan: 'asc' as const },
    };

    if (!paginated) {
      const employees = await db.employee.findMany(findArgs);
      return NextResponse.json(employees, { status: 200 });
    }

    const [total, employees] = await Promise.all([
      db.employee.count({ where }),
      db.employee.findMany({
        ...findArgs,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json(
      {
        data: employees,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/employees] Unexpected error:`, { error: error });
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

    logger.error(`[POST /api/${slug}/employees] Unexpected error:`, { error: error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
