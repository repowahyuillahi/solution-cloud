/**
 * POST /api/[slug]/auth/logout
 *
 * Destroys the current session by clearing the iron-session cookie.
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Await params to satisfy Next.js 14 App Router typing
  await params;

  try {
    // Destroy session
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.destroy();

    return NextResponse.json({ message: 'Logged out' }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[POST /api/[slug]/auth/logout] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
