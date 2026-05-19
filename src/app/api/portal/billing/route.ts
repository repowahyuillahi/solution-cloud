/**
 * GET /api/portal/billing — View subscription status and available plans
 * POST /api/portal/billing — Subscribe to a plan
 *
 * Both endpoints require portal authentication (session.portalTenantId).
 *
 * @see Requirements 14.1, 14.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import { prismaMaster } from '@/lib/db-master';
import { extendSubscription } from '@/services/subscription-manager';
import type { SubscriptionPlan } from '@/types';

/** Available subscription plans. */
const PLANS: SubscriptionPlan[] = [
  { type: 'monthly', priceIdr: 35000, durationDays: 30 },
  { type: 'yearly', priceIdr: 350000, durationDays: 365 },
];

/** Validation schema for subscribe request body. */
const subscribeSchema = z.object({
  planType: z.enum(['monthly', 'yearly']),
});

export async function GET(request: NextRequest) {
  // Check portal auth
  const session = await getSession(request);
  if (!session?.portalTenantId) {
    return createErrorResponse(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      'Anda harus login ke portal terlebih dahulu.',
    );
  }

  try {
    const tenant = await prismaMaster.tenant.findUnique({
      where: { id: session.portalTenantId },
    });

    if (!tenant) {
      return createErrorResponse(
        ErrorCode.TENANT_NOT_FOUND,
        'Tenant tidak ditemukan.',
      );
    }

    const now = new Date();
    const expiresAt = new Date(tenant.subscriptionExpiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      status: tenant.subscriptionStatus,
      expiresAt: tenant.subscriptionExpiresAt,
      daysRemaining,
      plans: PLANS.map((p) => ({ type: p.type, priceIdr: p.priceIdr })),
    });
  } catch (error: unknown) {
    logger.error('[GET /api/portal/billing] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}

export async function POST(request: NextRequest) {
  // Check portal auth
  const session = await getSession(request);
  if (!session?.portalTenantId) {
    return createErrorResponse(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
      'Anda harus login ke portal terlebih dahulu.',
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

  // Validate body
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path?.join('.') || undefined;
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      firstIssue?.message ?? 'Validasi input gagal.',
      field,
    );
  }

  try {
    const plan = PLANS.find((p) => p.type === parsed.data.planType);
    if (!plan) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Plan type tidak valid.',
        'planType',
      );
    }

    await extendSubscription(session.portalTenantId, plan);

    // Fetch updated tenant data
    const tenant = await prismaMaster.tenant.findUnique({
      where: { id: session.portalTenantId },
    });

    return NextResponse.json({
      status: tenant?.subscriptionStatus ?? 'active',
      expiresAt: tenant?.subscriptionExpiresAt,
      planType: parsed.data.planType,
    });
  } catch (error: unknown) {
    logger.error('[POST /api/portal/billing] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
