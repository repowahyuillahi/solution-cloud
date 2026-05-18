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
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

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

// In-memory config store (MVP — in production, store in tenant DB)
const notificationConfigs = new Map<string, NotificationConfig>();

const DEFAULT_CONFIG: NotificationConfig = {
  whatsapp: { enabled: false, recipients: [] },
  email: { enabled: false, recipients: [] },
  telegram: { enabled: false, chatIds: [] },
};

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

  const config = notificationConfigs.get(slug) ?? DEFAULT_CONFIG;
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

  let body: Partial<NotificationConfig>;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Body request tidak valid.');
  }

  const existing = notificationConfigs.get(slug) ?? DEFAULT_CONFIG;
  const updated: NotificationConfig = {
    whatsapp: { ...existing.whatsapp, ...body.whatsapp },
    email: { ...existing.email, ...body.email },
    telegram: { ...existing.telegram, ...body.telegram },
  };

  notificationConfigs.set(slug, updated);

  return NextResponse.json(
    { message: 'Konfigurasi notifikasi berhasil disimpan.', config: updated },
    { status: 200 },
  );
}
