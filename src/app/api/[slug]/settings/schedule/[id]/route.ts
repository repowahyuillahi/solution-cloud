/**
 * PUT /api/[slug]/settings/schedule/[id] — Update a branch schedule
 *
 * Body:
 *   - jamMasuk (string): HH:MM format
 *   - toleranceMinutes (number): minutes of tolerance
 *   - workDays (string): comma-separated day numbers (1=Mon, 7=Sun)
 *
 * Access: Superadmin only.
 *
 * @see Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { branchScheduleSchema } from '@/lib/validation';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const scheduleId = parseInt(id, 10);

  if (isNaN(scheduleId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID jadwal tidak valid.');
  }

  // Auth check — Superadmin only
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  // Parse and validate body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Body request tidak valid.');
  }

  // Transform workDays from comma-separated string to array if needed
  if (typeof body.workDays === 'string') {
    body.workDays = (body.workDays as string)
      .split(',')
      .map((d: string) => parseInt(d.trim(), 10))
      .filter((n: number) => !isNaN(n));
  }

  const parsed = branchScheduleSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Data jadwal tidak valid.',
      field,
    );
  }

  try {
    const db = await getTenantDb(slug);

    // Check schedule exists
    const existing = await db.branchSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!existing) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Jadwal tidak ditemukan.',
      );
    }

    // Update schedule
    const updated = await db.branchSchedule.update({
      where: { id: scheduleId },
      data: {
        jamMasuk: parsed.data.jamMasuk,
        toleranceMinutes: parsed.data.toleranceMinutes,
        workDays: parsed.data.workDays.join(','),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    console.error(`[PUT /api/${slug}/settings/schedule/${id}] Error:`, error);
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat memperbarui jadwal.',
    );
  }
}
