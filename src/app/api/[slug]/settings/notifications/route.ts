/**
 * GET/PUT /api/[slug]/settings/notifications — Notification channel config
 *
 * GET: Returns current notification channel configurations
 * PUT: Updates notification channel settings
 *
 * Access: Superadmin only.
 *
 * @see Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6
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

const SETTING_KEY = 'notifications';

interface NotificationConfig {
  whatsapp: {
    enabled: boolean;
    apiUrl?: string;
    apiKey?: string;
    recipients: string[];
  };
  email: {
    enabled: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    recipients: string[];
  };
  telegram: {
    enabled: boolean;
    botToken?: string;
    chatIds: string[];
  };
}

const DEFAULT_CONFIG: NotificationConfig = {
  whatsapp: { enabled: false, recipients: [] },
  email: { enabled: false, recipients: [] },
  telegram: { enabled: false, chatIds: [] },
};

async function loadConfig(slug: string): Promise<NotificationConfig> {
  const db = await getTenantDb(slug);
  const setting = await db.tenantSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!setting) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  try {
    const parsed = JSON.parse(setting.value) as Partial<NotificationConfig>;
    return {
      whatsapp: { ...DEFAULT_CONFIG.whatsapp, ...parsed.whatsapp },
      email: { ...DEFAULT_CONFIG.email, ...parsed.email },
      telegram: { ...DEFAULT_CONFIG.telegram, ...parsed.telegram },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

async function saveConfig(slug: string, config: NotificationConfig): Promise<void> {
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
    logger.error(`[GET /api/${slug}/settings/notifications] Error:`, { error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Gagal memuat konfigurasi notifikasi.');
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

  let body: Partial<NotificationConfig>;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Body request tidak valid.');
  }

  try {
    const existing = await loadConfig(slug);
    const updated: NotificationConfig = {
      whatsapp: { ...existing.whatsapp, ...body.whatsapp },
      email: { ...existing.email, ...body.email },
      telegram: { ...existing.telegram, ...body.telegram },
    };

    await saveConfig(slug, updated);

    return NextResponse.json(
      { message: 'Konfigurasi notifikasi berhasil disimpan.', config: updated },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[PUT /api/${slug}/settings/notifications] Error:`, { error });
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Gagal menyimpan konfigurasi notifikasi.');
  }
}
