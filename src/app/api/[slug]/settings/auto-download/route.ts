/**
 * GET/PUT /api/[slug]/settings/auto-download — Auto-download schedule config
 *
 * GET: Returns current auto-download configuration
 * PUT: Updates auto-download schedule
 *
 * Body (PUT):
 *   - enabled (boolean): whether auto-download is active
 *   - scheduleTime (string): HH:MM format for daily download time
 *
 * Access: Superadmin only.
 *
 * @see Requirements 16.1, 16.2, 16.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

// In-memory config store (in production, this would be in the tenant DB)
// For MVP, we store configs in a simple Map keyed by tenant slug
const autoDownloadConfigs = new Map<string, { enabled: boolean; scheduleTime: string }>();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  if (session.tenantSlug !== slug) {
    return createErrorResponse(ErrorCode.RBAC_CROSS_TENANT_ACCESS, 'Akses lintas tenant tidak diizinkan.');
  }

  const config = autoDownloadConfigs.get(slug) ?? { enabled: false, scheduleTime: '06:00' };
  return NextResponse.json(config, { status: 200 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  if (session.tenantSlug !== slug) {
    return createErrorResponse(ErrorCode.RBAC_CROSS_TENANT_ACCESS, 'Akses lintas tenant tidak diizinkan.');
  }

  let body: { enabled?: boolean; scheduleTime?: string };
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Body request tidak valid.');
  }

  const enabled = body.enabled ?? false;
  const scheduleTime = body.scheduleTime ?? '06:00';

  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(scheduleTime)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Format waktu tidak valid (HH:MM).', 'scheduleTime');
  }

  autoDownloadConfigs.set(slug, { enabled, scheduleTime });

  return NextResponse.json(
    { message: 'Konfigurasi auto-download berhasil disimpan.', enabled, scheduleTime },
    { status: 200 },
  );
}
