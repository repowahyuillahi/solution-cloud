/**
 * GET /api/health — Health check endpoint
 *
 * Returns:
 *   - 200 OK with status info when healthy
 *   - 503 Service Unavailable when DB is unreachable
 *
 * Used by Docker health checks and external monitoring.
 *
 * @see Requirements 18.6, 18.7
 */

import { NextResponse } from 'next/server';
import { prismaMaster } from '@/lib/db-master';
import { getDataDirectorySize, getDatabasesDirectorySize, formatBytes } from '@/lib/disk-usage';

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { status: 'ok' | 'fail'; detail?: string; durationMs?: number }> = {};

  // 1. Master DB connectivity check
  const dbStart = Date.now();
  try {
    await prismaMaster.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', durationMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: 'fail',
      detail: err instanceof Error ? err.message : 'unknown',
      durationMs: Date.now() - dbStart,
    };
  }

  // 2. Disk usage info (informational, never fails)
  try {
    const data = getDataDirectorySize();
    const dbs = getDatabasesDirectorySize();
    checks.disk = {
      status: 'ok',
      detail: `data=${formatBytes(data.bytes)}, databases=${formatBytes(dbs.bytes)}`,
    };
  } catch {
    checks.disk = { status: 'ok', detail: 'unable to read' };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  const body = {
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    durationMs: Date.now() - startedAt,
    checks,
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
