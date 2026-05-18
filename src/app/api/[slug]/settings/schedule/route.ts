/**
 * GET /api/[slug]/settings/schedule — List all branch schedules
 *
 * Returns all branch schedules for the tenant. If a branch doesn't have
 * a custom schedule, a default schedule is auto-created.
 *
 * Access: Superadmin only.
 *
 * @see Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

const DEFAULT_JAM_MASUK = '08:00';
const DEFAULT_TOLERANCE = 5;
const DEFAULT_WORK_DAYS = '1,2,3,4,5,6,7';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

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

  try {
    const db = await getTenantDb(slug);

    // Get all machines (branches)
    const machines = await db.machine.findMany({
      select: { kodeDealer: true, namaDealer: true },
    });

    // Get existing schedules
    const existingSchedules = await db.branchSchedule.findMany();
    const scheduleMap = new Map(
      existingSchedules.map((s) => [s.kodeDealer, s])
    );

    // Auto-create default schedules for branches without one
    const schedules = [];
    for (const machine of machines) {
      let schedule = scheduleMap.get(machine.kodeDealer);
      if (!schedule) {
        // Create default schedule
        schedule = await db.branchSchedule.create({
          data: {
            kodeDealer: machine.kodeDealer,
            jamMasuk: DEFAULT_JAM_MASUK,
            toleranceMinutes: DEFAULT_TOLERANCE,
            workDays: DEFAULT_WORK_DAYS,
          },
        });
      }
      schedules.push({
        ...schedule,
        namaDealer: machine.namaDealer,
      });
    }

    return NextResponse.json(schedules, { status: 200 });
  } catch (error: unknown) {
    console.error(`[GET /api/${slug}/settings/schedule] Error:`, error);
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan saat memuat jadwal.',
    );
  }
}
