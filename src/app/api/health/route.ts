/**
 * GET /api/health — Health check endpoint
 *
 * Returns basic health status of the application.
 * Used by Docker health checks and monitoring.
 *
 * @see Requirements 18.6, 18.7
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 },
  );
}
