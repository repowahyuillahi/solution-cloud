/**
 * GET /api/[slug]/auth/session
 *
 * Returns the current session data if the user is authenticated
 * and the session's tenantSlug matches the route slug.
 *
 * @see Requirements 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { SessionData } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    // Check if session is valid and belongs to this tenant
    if (!session.loginAt || session.tenantSlug !== slug) {
      return createErrorResponse(
        ErrorCode.AUTH_NOT_AUTHENTICATED,
        'Sesi tidak valid atau sudah berakhir.',
      );
    }

    return NextResponse.json(
      {
        userId: session.userId,
        username: session.username,
        role: session.role,
        tenantSlug: session.tenantSlug,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(`[GET /api/${slug}/auth/session] Unexpected error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
