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
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { SessionData } from '@/types';

const SETTING_KEY = 'auto-download';
const DEFAULT_CONFIG = { enabled: false, scheduleTime: '06:00' };

interface AutoDownloadConfig {
  enabled: boolean;
  scheduleTime: string;
}

async function loadConfig(slug: string): Promise<AutoDownloadConfig> {
  const db = await getTenantDb(slug);
  const setting = await db.tenantSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(setting.value) as Partial<AutoDownloadConfig>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
      scheduleTime: typeof parsed.scheduleTime === 'string' ? parsed.scheduleTime : '06:00',
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(slug: string, config: AutoDownloadConfig): Promise<void> {
  const db = await getTenantDb(slug);
  const value = JSON.stringify(config);
  await db.tenantSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value },
    update: { value },
  });
}

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

  try {
    const config = await loadConfig(slug);
    return NextResponse.json(config, { status: 200 });
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/settings/auto-download] Error:`, { error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Gagal memuat konfigurasi.');
  }
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

  if (!/^\d{2}:\d{2}$/.test(scheduleTime)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Format waktu tidak valid (HH:MM).', 'scheduleTime');
  }

  try {
    await saveConfig(slug, { enabled, scheduleTime });
    return NextResponse.json(
      { message: 'Konfigurasi auto-download berhasil disimpan.', enabled, scheduleTime },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[PUT /api/${slug}/settings/auto-download] Error:`, { error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Gagal menyimpan konfigurasi.');
  }
}
