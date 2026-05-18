/**
 * Tests for Report Export Service
 *
 * Tests the exportToExcel and exportToPdf functions that convert
 * AttendanceRecord[] data into downloadable Excel and PDF files.
 *
 * @see Requirements 6.6, 6.7
 */

import { describe, it, expect } from 'vitest';
import {
  exportToExcel,
  exportToPdf,
  formatDateIndonesian,
  computeSummaryStats,
} from './report-export';
import type { AttendanceRecord, TenantInfo } from '@/types';
import ExcelJS from 'exceljs';

// ============================================================================
// Test Data
// ============================================================================

const mockTenantInfo: TenantInfo = {
  id: 1,
  companyName: 'CV TJAHAJA BARU',
  slug: 'tjahaja-baru',
  dbPath: 'databases/tenants/tjahaja-baru.sqlite',
  licenseCode: 'TEST-LICENSE-001',
  subscriptionStatus: 'active',
  expiresAt: new Date('2025-12-31'),
  isActivated: true,
  logoUrl: null,
  customDomain: null,
};

const mockRecords: AttendanceRecord[] = [
  {
    kodeDealer: 'D001',
    namaDealer: 'Dealer Utama',
    tanggal: '2025-01-15',
    kodeKaryawan: 'K001',
    namaKaryawan: 'Budi Santoso',
    jamMasuk: '07:55:00',
    jamPulang: '17:02:00',
    totalTap: 2,
    status: 'Tepat Waktu',
  },
  {
    kodeDealer: 'D001',
    namaDealer: 'Dealer Utama',
    tanggal: '2025-01-15',
    kodeKaryawan: 'K002',
    namaKaryawan: 'Siti Rahayu',
    jamMasuk: '08:15:00',
    jamPulang: '17:10:00',
    totalTap: 3,
    status: 'Telat',
  },
  {
    kodeDealer: 'D001',
    namaDealer: 'Dealer Utama',
    tanggal: '2025-01-15',
    kodeKaryawan: 'K003',
    namaKaryawan: 'Ahmad Fauzi',
    jamMasuk: null,
    jamPulang: null,
    totalTap: 0,
    status: 'Tidak Masuk',
  },
  {
    kodeDealer: 'D002',
    namaDealer: 'Dealer Cabang',
    tanggal: '2025-01-16',
    kodeKaryawan: 'K004',
    namaKaryawan: 'Dewi Lestari',
    jamMasuk: '08:00:00',
    jamPulang: null,
    totalTap: 1,
    status: 'Tepat Waktu',
  },
];

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('formatDateIndonesian', () => {
  it('should format YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDateIndonesian('2025-01-15')).toBe('15/01/2025');
    expect(formatDateIndonesian('2025-12-31')).toBe('31/12/2025');
  });

  it('should return original string if format is invalid', () => {
    expect(formatDateIndonesian('invalid')).toBe('invalid');
    expect(formatDateIndonesian('')).toBe('');
  });
});

describe('computeSummaryStats', () => {
  it('should compute correct statistics from records', () => {
    const stats = computeSummaryStats(mockRecords);

    expect(stats.totalEmployees).toBe(4);
    expect(stats.totalWorkDays).toBe(2);
    expect(stats.tepatWaktu).toBe(2);
    expect(stats.telat).toBe(1);
    expect(stats.tidakMasuk).toBe(1);
    expect(stats.attendancePercentage).toBe(75); // (2+1)/4 * 100
  });

  it('should handle empty records', () => {
    const stats = computeSummaryStats([]);

    expect(stats.totalEmployees).toBe(0);
    expect(stats.totalWorkDays).toBe(0);
    expect(stats.tepatWaktu).toBe(0);
    expect(stats.telat).toBe(0);
    expect(stats.tidakMasuk).toBe(0);
    expect(stats.attendancePercentage).toBe(0);
  });
});

// ============================================================================
// Excel Export Tests
// ============================================================================

describe('exportToExcel', () => {
  it('should generate a valid Excel buffer', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should contain the correct company name in header', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();

    // First row should be company name
    const titleCell = worksheet!.getCell('A1');
    expect(titleCell.value).toBe('CV TJAHAJA BARU');
  });

  it('should contain all column headers', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();

    // Row 4 should be column headers (row 1=title, row 2=subtitle, row 3=empty)
    const headerRow = worksheet!.getRow(4);
    const headers = [];
    for (let col = 1; col <= 9; col++) {
      headers.push(headerRow.getCell(col).value);
    }

    expect(headers).toEqual([
      'Kode Dealer',
      'Nama Dealer',
      'Tanggal',
      'Kode Karyawan',
      'Nama Karyawan',
      'Jam Masuk',
      'Jam Pulang',
      'Total Tap',
      'Status',
    ]);
  });

  it('should contain data rows with correct values', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();

    // First data row is row 5
    const firstDataRow = worksheet!.getRow(5);
    expect(firstDataRow.getCell(1).value).toBe('D001');
    expect(firstDataRow.getCell(2).value).toBe('Dealer Utama');
    expect(firstDataRow.getCell(3).value).toBe('15/01/2025');
    expect(firstDataRow.getCell(4).value).toBe('K001');
    expect(firstDataRow.getCell(5).value).toBe('Budi Santoso');
    expect(firstDataRow.getCell(6).value).toBe('07:55:00');
    expect(firstDataRow.getCell(7).value).toBe('17:02:00');
    expect(firstDataRow.getCell(8).value).toBe(2);
    expect(firstDataRow.getCell(9).value).toBe('Tepat Waktu');
  });

  it('should display "-" for null jam masuk/pulang', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();

    // Third data row (row 7) has null jam masuk/pulang
    const absentRow = worksheet!.getRow(7);
    expect(absentRow.getCell(6).value).toBe('-');
    expect(absentRow.getCell(7).value).toBe('-');
  });

  it('should color-code status cells', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();

    // Row 5: Tepat Waktu (green)
    const tepatWaktuCell = worksheet!.getRow(5).getCell(9);
    const tepatWaktuFill = tepatWaktuCell.fill as ExcelJS.FillPattern;
    expect(tepatWaktuFill.fgColor?.argb).toBe('FF4CAF50');

    // Row 6: Telat (red)
    const telatCell = worksheet!.getRow(6).getCell(9);
    const telatFill = telatCell.fill as ExcelJS.FillPattern;
    expect(telatFill.fgColor?.argb).toBe('FFF44336');

    // Row 7: Tidak Masuk (gray)
    const tidakMasukCell = worksheet!.getRow(7).getCell(9);
    const tidakMasukFill = tidakMasukCell.fill as ExcelJS.FillPattern;
    expect(tidakMasukFill.fgColor?.argb).toBe('FF9E9E9E');
  });

  it('should include summary statistics', async () => {
    const buffer = await exportToExcel(mockRecords, mockTenantInfo);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();

    // Summary starts after data rows + empty row
    // Data rows: 4 records → rows 5-8, then row 9 empty, row 10 "Ringkasan"
    const summaryHeaderRow = worksheet!.getRow(10);
    expect(summaryHeaderRow.getCell(1).value).toBe('Ringkasan');
  });

  it('should handle empty records', async () => {
    const buffer = await exportToExcel([], mockTenantInfo);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet('Laporan Absensi');
    expect(worksheet).toBeDefined();
  });
});

// ============================================================================
// PDF Export Tests
// ============================================================================

describe('exportToPdf', () => {
  it('should generate a valid PDF buffer', async () => {
    const buffer = await exportToPdf(mockRecords, mockTenantInfo);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // PDF files start with %PDF
    const header = buffer.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('should handle empty records', async () => {
    const buffer = await exportToPdf([], mockTenantInfo);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const header = buffer.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('should produce a PDF with reasonable size for the data', async () => {
    const buffer = await exportToPdf(mockRecords, mockTenantInfo);

    // A PDF with 4 records and headers should be at least a few KB
    expect(buffer.length).toBeGreaterThan(1000);

    // But not unreasonably large (less than 1MB for 4 records)
    expect(buffer.length).toBeLessThan(1024 * 1024);
  });
});
