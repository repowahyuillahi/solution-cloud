/**
 * POST /api/[slug]/download/bulk — Start bulk attendance download (SSE stream)
 *
 * Triggers a bulk download from all registered machines for the tenant.
 * Streams progress events via Server-Sent Events (SSE) as each machine
 * completes (success/failure). Sends a final "complete" event with summary.
 *
 * Access: Superadmin, HRD only.
 * Prevents concurrent downloads for the same tenant.
 *
 * @see Requirements 5.6, 5.7, 5.9, 5.11, 5.12
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  startBulkDownload,
  isDownloadInProgress,
} from '@/services/attendance-downloader';
import type { SessionData, DownloadProgress, BulkDownloadResult } from '@/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth & RBAC check — Superadmin or HRD
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  // Verify session belongs to this tenant
  if (session.tenantSlug !== slug) {
    return createErrorResponse(
      ErrorCode.RBAC_CROSS_TENANT_ACCESS,
      'Akses lintas tenant tidak diizinkan.',
    );
  }

  // Prevent concurrent downloads (Requirement 5.7)
  if (isDownloadInProgress(slug)) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Bulk download sedang berjalan. Silakan tunggu hingga selesai.',
      undefined,
      409,
    );
  }

  // Get machines from tenant database
  let machines: Array<{
    id: number;
    kodeDealer: string;
    namaDealer: string;
    serialNumber: string;
    password: string;
  }>;

  try {
    const db = await getTenantDb(slug);
    machines = await db.machine.findMany({
      select: {
        id: true,
        kodeDealer: true,
        namaDealer: true,
        serialNumber: true,
        password: true,
      },
    });
  } catch (error: unknown) {
    logger.error(`[POST /api/${slug}/download/bulk] DB error:`, { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_DATABASE_ERROR,
      'Gagal mengambil data mesin dari database.',
    );
  }

  // No machines registered (Requirement 5.11)
  if (machines.length === 0) {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Tidak ada mesin yang terdaftar. Tambahkan mesin terlebih dahulu.',
      undefined,
      400,
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Helper to send an SSE event
      function sendEvent(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Send initial event with total machines count
      sendEvent('start', {
        totalMachines: machines.length,
        message: `Memulai download dari ${machines.length} mesin...`,
      });

      // Progress callback for the downloader service
      const onProgress = (progress: DownloadProgress) => {
        sendEvent('progress', {
          machineId: progress.machineId,
          kodeDealer: progress.kodeDealer,
          namaDealer: progress.namaDealer,
          status: progress.status,
          error: progress.error,
          logsCount: progress.logsCount,
        });
      };

      // Start the bulk download
      startBulkDownload(slug, machines, onProgress)
        .then((result: BulkDownloadResult) => {
          // Send complete event with summary
          sendEvent('complete', {
            totalMachines: result.totalMachines,
            successCount: result.successCount,
            failedCount: result.failedCount,
            totalLogs: result.totalLogs,
            startedAt: result.startedAt.toISOString(),
            completedAt: result.completedAt.toISOString(),
          });

          // Save download history to tenant DB
          saveDownloadHistory(slug, session.userId!, result).catch((err) => {
            logger.error(`[POST /api/${slug}/download/bulk] Failed to save history:`, { error: err });
          });

          controller.close();
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown error';
          sendEvent('error', { message });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Save the bulk download result to the tenant's DownloadHistory table.
 */
async function saveDownloadHistory(
  tenantSlug: string,
  userId: number,
  result: BulkDownloadResult,
): Promise<void> {
  const db = await getTenantDb(tenantSlug);
  await db.downloadHistory.create({
    data: {
      triggeredById: userId,
      totalMachines: result.totalMachines,
      successCount: result.successCount,
      failedCount: result.failedCount,
      totalLogs: result.totalLogs,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    },
  });
}
