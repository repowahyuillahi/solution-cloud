/**
 * POST /api/portal/profile/logo — Upload company logo
 *
 * Accepts multipart form data with a 'logo' file field.
 * Validates: PNG/JPG/SVG, max 2MB.
 * Saves to uploads/{slug}/logo.{ext} and updates tenant logoUrl.
 *
 * Requires portal authentication (session.portalTenantId).
 *
 * @see Requirements 14.10
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';

import { createErrorResponse, ErrorCode } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';
import { prismaMaster } from '@/lib/db-master';

/** Allowed MIME types for logo upload. */
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
];

/** Maximum file size: 2MB. */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Verify file content matches the claimed MIME type by checking the magic
 * number (file signature). This prevents attackers from uploading executable
 * content disguised as an image.
 */
function verifyImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 8) return false;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // SVG: must start with "<?xml" or "<svg" (case-insensitive)
  if (mimeType === 'image/svg+xml') {
    const head = buffer.slice(0, 200).toString('utf-8').trimStart().toLowerCase();
    return head.startsWith('<?xml') || head.startsWith('<svg');
  }

  return false;
}

/** Map MIME type to file extension. */
function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
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

  try {
    // Get tenant info for slug
    const tenant = await prismaMaster.tenant.findUnique({
      where: { id: session.portalTenantId },
    });

    if (!tenant) {
      return createErrorResponse(
        ErrorCode.TENANT_NOT_FOUND,
        'Tenant tidak ditemukan.',
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('logo');

    if (!file || !(file instanceof File)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'File logo wajib diunggah.',
        'logo',
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_INVALID_FORMAT,
        'Format file harus PNG, JPG, atau SVG.',
        'logo',
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        'Ukuran file maksimal 2MB.',
        'logo',
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify magic number matches claimed MIME type (anti-spoofing)
    if (!verifyImageSignature(buffer, file.type)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_INVALID_FORMAT,
        'Konten file tidak sesuai dengan format yang diklaim.',
        'logo',
      );
    }

    // Determine save path
    const ext = getExtension(file.type);
    const uploadDir = path.resolve(process.cwd(), 'uploads', tenant.slug);
    const fileName = `logo.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(filePath, buffer);

    // Update tenant logoUrl in master DB
    const logoUrl = `/uploads/${tenant.slug}/${fileName}`;
    await prismaMaster.tenant.update({
      where: { id: session.portalTenantId },
      data: { logoUrl },
    });

    return NextResponse.json({ logoUrl });
  } catch (error: unknown) {
    logger.error('[POST /api/portal/profile/logo] Unexpected error:', { error: error });
    return createErrorResponse(
      ErrorCode.SERVER_INTERNAL_ERROR,
      'Terjadi kesalahan internal server.',
    );
  }
}
