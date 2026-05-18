/**
 * PUT    /api/[slug]/employees/[id] — Update an employee
 * DELETE /api/[slug]/employees/[id] — Delete an employee
 *
 * @see Requirements 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

import { sessionOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getTenantDb } from '@/lib/db-tenant';
import { createErrorResponse, ErrorCode } from '@/lib/errors';
import type { SessionData } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const employeeId = parseInt(id, 10);

  if (isNaN(employeeId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID karyawan tidak valid.');
  }

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
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

  const { namaKaryawan, branches } = body as {
    namaKaryawan?: string;
    branches?: string[];
  };

  try {
    const db = await getTenantDb(slug);

    // Check if employee exists
    const existing = await db.employee.findUnique({ where: { id: employeeId } });
    if (!existing) {
      return createErrorResponse(ErrorCode.NOT_FOUND_EMPLOYEE, 'Karyawan tidak ditemukan.', undefined, 404);
    }

    // Update employee and reassign branches in a transaction
    const updated = await db.$transaction(async (tx) => {
      // Update employee fields
      const updateData: { namaKaryawan?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (namaKaryawan !== undefined) {
        updateData.namaKaryawan = namaKaryawan;
      }

      await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      // Reassign branches if provided
      if (branches !== undefined) {
        // Delete existing assignments
        await tx.branchAssignment.deleteMany({
          where: { employeeId },
        });

        // Create new assignments
        if (branches.length > 0) {
          await tx.branchAssignment.createMany({
            data: branches.map((kodeDealer) => ({
              employeeId,
              kodeDealer,
            })),
          });
        }
      }

      // Return updated employee with assignments
      return tx.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          kodeKaryawan: true,
          namaKaryawan: true,
          branchAssignments: {
            select: {
              kodeDealer: true,
            },
          },
        },
      });
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    console.error(`[PUT /api/${slug}/employees/${id}] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const employeeId = parseInt(id, 10);

  if (isNaN(employeeId)) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'ID karyawan tidak valid.');
  }

  // Auth & RBAC check
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  const check = requireRole(['Superadmin', 'HRD'])(session.loginAt ? session : null);
  if (!check.allowed) {
    return createErrorResponse(ErrorCode.RBAC_INSUFFICIENT_PERMISSION, 'Akses ditolak.');
  }

  try {
    const db = await getTenantDb(slug);

    // Check if employee exists
    const existing = await db.employee.findUnique({ where: { id: employeeId } });
    if (!existing) {
      return createErrorResponse(ErrorCode.NOT_FOUND_EMPLOYEE, 'Karyawan tidak ditemukan.', undefined, 404);
    }

    // Delete employee (cascade will remove BranchAssignments)
    await db.employee.delete({ where: { id: employeeId } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error(`[DELETE /api/${slug}/employees/${id}] Unexpected error:`, error);
    return createErrorResponse(ErrorCode.SERVER_INTERNAL_ERROR, 'Terjadi kesalahan internal server.');
  }
}
