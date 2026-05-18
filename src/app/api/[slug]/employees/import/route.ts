/**
 * POST /api/[slug]/employees/import — Bulk import employees from Excel
 *
 * Accepts multipart form data with:
 * - file: .xlsx file with columns kodeKaryawan, namaKaryawan
 * - kodeDealer: branch code to assign imported employees to
 *
 * @see Requirements 4.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { importEmployeesFromExcel } from '@/services/employee-import';
import type { SessionData } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'Request harus berupa multipart form data.',
    );
  }

  const file = formData.get('file') as File | null;
  const kodeDealer = formData.get('kodeDealer') as string | null;

  if (!file) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'File Excel wajib diunggah.', 'file');
  }

  if (!kodeDealer) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Kode dealer wajib diisi.', 'kodeDealer');
  }

  // Read Excel file buffer
  let fileBuffer: ArrayBuffer;
  try {
    fileBuffer = await file.arrayBuffer();
  } catch {
    return createErrorResponse(
      ErrorCode.VALIDATION_FAILED,
      'File tidak dapat dibaca.',
      'file',
    );
  }

  // Import employees using the service
  const db = await getTenantDb(slug);

  try {
    const result = await importEmployeesFromExcel({ db, fileBuffer, kodeDealer });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengimpor karyawan.';
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, message, 'file');
  }
}
