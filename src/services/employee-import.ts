/**
 * Employee Import Service
 *
 * Handles bulk import of employees from Excel (.xlsx) files.
 * Parses the workbook, validates each row, and creates Employee
 * records with BranchAssignment in the tenant database.
 *
 * @see Requirements 4.5
 */

import ExcelJS from 'exceljs';
import type { PrismaClient } from '@/generated/tenant';
import type { ImportResult } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ImportOptions {
  db: PrismaClient;
  fileBuffer: ArrayBuffer;
  kodeDealer: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a single employee row from the Excel file.
 *
 * Rules:
 * - Both kodeKaryawan and namaKaryawan must be non-empty.
 * - Each field must be at most 100 characters.
 */
export function validateEmployeeRow(
  kodeKaryawan: string,
  namaKaryawan: string,
): { valid: boolean; error?: string } {
  if (!kodeKaryawan || !namaKaryawan) {
    return { valid: false, error: 'kodeKaryawan dan namaKaryawan wajib diisi.' };
  }

  if (kodeKaryawan.length > 100) {
    return { valid: false, error: 'kodeKaryawan melebihi 100 karakter.' };
  }

  if (namaKaryawan.length > 100) {
    return { valid: false, error: 'namaKaryawan melebihi 100 karakter.' };
  }

  return { valid: true };
}

// ============================================================================
// Import Logic
// ============================================================================

/**
 * Import employees from an Excel buffer into the tenant database.
 *
 * Steps:
 *   1. Load workbook from the provided ArrayBuffer.
 *   2. Get the first worksheet.
 *   3. Parse rows (skip header): expect col1=kodeKaryawan, col2=namaKaryawan.
 *   4. For each row:
 *      - Validate: both fields non-empty, max 100 chars.
 *      - Check if kodeKaryawan exists → skip (increment skippedCount).
 *      - Create employee + BranchAssignment → success.
 *      - On error → failedCount + add to errors.
 *   5. Return ImportResult.
 *
 * @throws Error if the workbook cannot be loaded or has no worksheets.
 */
export async function importEmployeesFromExcel(
  options: ImportOptions,
): Promise<ImportResult> {
  const { db, fileBuffer, kodeDealer } = options;

  // 1. Load workbook from buffer
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  // 2. Get first worksheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File Excel tidak memiliki worksheet.');
  }

  // 3. Parse rows (skip header)
  const rows: Array<{ rowNum: number; kodeKaryawan: string; namaKaryawan: string }> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const kodeKaryawan = String(row.getCell(1).value ?? '').trim();
    const namaKaryawan = String(row.getCell(2).value ?? '').trim();

    rows.push({ rowNum: rowNumber, kodeKaryawan, namaKaryawan });
  });

  // 4. Process each row
  const result: ImportResult = {
    totalRows: rows.length,
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
  };

  for (const row of rows) {
    // Validate row
    const validation = validateEmployeeRow(row.kodeKaryawan, row.namaKaryawan);
    if (!validation.valid) {
      result.failedCount++;
      result.errors.push({
        row: row.rowNum,
        reason: validation.error!,
      });
      continue;
    }

    // Check if kodeKaryawan already exists
    const existing = await db.employee.findUnique({
      where: { kodeKaryawan: row.kodeKaryawan },
    });

    if (existing) {
      result.skippedCount++;
      continue;
    }

    // Create employee + branch assignment
    try {
      await db.employee.create({
        data: {
          kodeKaryawan: row.kodeKaryawan,
          namaKaryawan: row.namaKaryawan,
          updatedAt: new Date(),
          branchAssignments: {
            create: [{ kodeDealer }],
          },
        },
      });
      result.successCount++;
    } catch {
      result.failedCount++;
      result.errors.push({
        row: row.rowNum,
        reason: `Gagal menyimpan karyawan '${row.kodeKaryawan}'.`,
      });
    }
  }

  // 5. Return ImportResult
  return result;
}
