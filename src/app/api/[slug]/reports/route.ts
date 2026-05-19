/**
 * GET /api/[slug]/reports — Generate attendance report data
 *
 * Query params:
 *   - startDate (required): YYYY-MM-DD
 *   - endDate (required): YYYY-MM-DD
 *   - kodeDealer (optional): filter by branch
 *
 * Returns JSON array of AttendanceRecord[].
 * Requires authentication (any role: Superadmin, HRD, Resepsionis).
 *
 * @see Requirements 6.4, 6.5, 6.9, 6.13
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { reportFilterSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { resolveBySlug } from '@/lib/tenant-resolver';
import { generateReport } from '@/services/report-generator';
import type { SessionData } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth check — all authenticated roles can access reports
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD', 'Resepsionis'])(
    session.loginAt ? session : null,
  );
  if (!check.allowed) {
    return createErrorResponse(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      'Autentikasi diperlukan untuk mengakses laporan.',
    );
  }

  // Verify tenant session ownership
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  // Validate tenant exists
  const tenant = await resolveBySlug(slug);
  if (!tenant) {
    return createErrorResponse(ErrorCode.TENANT_NOT_FOUND, 'Tenant tidak ditemukan.');
  }

  // Parse and validate query parameters
  const searchParams = request.nextUrl.searchParams;
  const filterInput = {
    startDate: searchParams.get('startDate') ?? '',
    endDate: searchParams.get('endDate') ?? '',
    kodeDealer: searchParams.get('kodeDealer') || undefined,
  };

  const parsed = reportFilterSchema.safeParse(filterInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Parameter tanggal tidak valid.',
      field,
    );
  }

  try {
    const records = await generateReport(slug, parsed.data);
    return NextResponse.json(records, { status: 200 });
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/reports] Unexpected error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat membuat laporan.',
    );
  }
}
