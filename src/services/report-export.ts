/**
 * Report Export Service
 *
 * Handles exporting attendance report data to Excel (.xlsx) and PDF formats.
 * Includes company branding, proper formatting, and color-coded status cells.
 *
 * @see Requirements 6.6, 6.7
 */

import ExcelJS from 'exceljs';
import type { TDocumentDefinitions, Content, StyleDictionary } from 'pdfmake/interfaces';
import type { AttendanceRecord, TenantInfo } from '@/types';

// ============================================================================
// Types
// ============================================================================

/** pdfmake v0.3.x singleton instance type. */
interface PdfMakeInstance {
  fonts: Record<string, Record<string, string>>;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(docDefinition: TDocumentDefinitions, options?: object): {
    getBuffer(): Promise<Buffer>;
    getBase64(): Promise<string>;
    getStream(): Promise<NodeJS.ReadableStream>;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Column headers for the attendance report (Indonesian). */
const REPORT_COLUMNS = [
  'Kode Dealer',
  'Nama Dealer',
  'Tanggal',
  'Kode Karyawan',
  'Nama Karyawan',
  'Jam Masuk',
  'Jam Pulang',
  'Total Tap',
  'Status',
] as const;

/** Status color mapping for Excel cells. */
const STATUS_COLORS: Record<string, string> = {
  'Tepat Waktu': '4CAF50', // Green
  'Telat': 'F44336',       // Red
  'Tidak Masuk': '9E9E9E', // Gray
};

/** Status color mapping for PDF cells (lighter backgrounds). */
const STATUS_COLORS_PDF: Record<string, string> = {
  'Tepat Waktu': '#E8F5E9', // Light green
  'Telat': '#FFEBEE',       // Light red
  'Tidak Masuk': '#F5F5F5', // Light gray
};

// ============================================================================
// Excel Export
// ============================================================================

/**
 * Export attendance records to an Excel (.xlsx) file.
 *
 * Features:
 * - Company name in header row
 * - Proper column widths and formatting
 * - Color-coded status cells (green=Tepat Waktu, red=Telat, gray=Tidak Masuk)
 * - Date formatted in Indonesian locale (DD/MM/YYYY)
 * - Summary statistics at the bottom
 *
 * @param records - Array of attendance records to export
 * @param tenantInfo - Tenant information for branding
 * @returns Buffer containing the .xlsx file
 */
export async function exportToExcel(
  records: AttendanceRecord[],
  tenantInfo: TenantInfo,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = tenantInfo.companyName;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Laporan Absensi');

  // --- Header: Company Name ---
  const titleRow = worksheet.addRow([tenantInfo.companyName]);
  titleRow.font = { bold: true, size: 16 };
  worksheet.mergeCells(1, 1, 1, REPORT_COLUMNS.length);
  titleRow.alignment = { horizontal: 'center' };

  // --- Subtitle: Report period ---
  const subtitle = buildSubtitle(records);
  const subtitleRow = worksheet.addRow([subtitle]);
  subtitleRow.font = { size: 11, italic: true };
  worksheet.mergeCells(2, 1, 2, REPORT_COLUMNS.length);
  subtitleRow.alignment = { horizontal: 'center' };

  // --- Empty row ---
  worksheet.addRow([]);

  // --- Column Headers ---
  const headerRow = worksheet.addRow(REPORT_COLUMNS as unknown as string[]);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1976D2' }, // Blue header
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 22;

  // Set column widths
  const columnWidths = [14, 20, 14, 14, 22, 12, 12, 10, 14];
  worksheet.columns = columnWidths.map((width) => ({ width }));

  // --- Data Rows ---
  for (const record of records) {
    const row = worksheet.addRow([
      record.kodeDealer,
      record.namaDealer,
      formatDateIndonesian(record.tanggal),
      record.kodeKaryawan,
      record.namaKaryawan,
      record.jamMasuk ?? '-',
      record.jamPulang ?? '-',
      record.totalTap,
      record.status,
    ]);

    // Color-code the status cell (column 9)
    const statusCell = row.getCell(9);
    const statusColor = STATUS_COLORS[record.status];
    if (statusColor) {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${statusColor}` },
      };
      statusCell.font = {
        bold: true,
        color: { argb: record.status === 'Tidak Masuk' ? 'FF424242' : 'FFFFFFFF' },
      };
    }

    // Center-align specific columns
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'center' };
  }

  // --- Summary Statistics ---
  worksheet.addRow([]); // Empty row before summary
  const stats = computeSummaryStats(records);

  const summaryHeaderRow = worksheet.addRow(['Ringkasan']);
  summaryHeaderRow.font = { bold: true, size: 12 };

  worksheet.addRow(['Total Karyawan', stats.totalEmployees]);
  worksheet.addRow(['Total Hari Kerja', stats.totalWorkDays]);
  worksheet.addRow(['Tepat Waktu', stats.tepatWaktu]);
  worksheet.addRow(['Telat', stats.telat]);
  worksheet.addRow(['Tidak Masuk', stats.tidakMasuk]);
  worksheet.addRow([
    'Persentase Kehadiran',
    `${stats.attendancePercentage.toFixed(1)}%`,
  ]);

  // --- Add borders to data area ---
  const dataStartRow = 4; // Header row
  const dataEndRow = 4 + records.length;
  for (let rowIdx = dataStartRow; rowIdx <= dataEndRow; rowIdx++) {
    const row = worksheet.getRow(rowIdx);
    for (let colIdx = 1; colIdx <= REPORT_COLUMNS.length; colIdx++) {
      row.getCell(colIdx).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// PDF Export
// ============================================================================

/**
 * Export attendance records to a PDF file.
 *
 * Features:
 * - Company name in header
 * - Formatted table with proper column widths
 * - Color-coded status cells
 * - Date formatted in Indonesian locale
 * - Summary statistics at the bottom
 * - Landscape orientation for better table fit
 *
 * @param records - Array of attendance records to export
 * @param tenantInfo - Tenant information for branding
 * @returns Buffer containing the PDF file
 */
export async function exportToPdf(
  records: AttendanceRecord[],
  tenantInfo: TenantInfo,
): Promise<Buffer> {
  // pdfmake v0.3.x exports a singleton instance
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfmake = require('pdfmake') as PdfMakeInstance;

  // Configure fonts (Roboto bundled with pdfmake)
  const path = await import('path');
  const fontsDir = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');
  pdfmake.fonts = {
    Roboto: {
      normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
      bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
      italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
    },
  };

  // Allow local file access for fonts
  pdfmake.setLocalAccessPolicy(() => true);

  const subtitle = buildSubtitle(records);
  const stats = computeSummaryStats(records);

  // Build table body
  const tableBody = buildPdfTableBody(records);

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [30, 40, 30, 40],

    content: [
      // Header
      {
        text: tenantInfo.companyName,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 4],
      } as Content,
      {
        text: 'Laporan Absensi Karyawan',
        style: 'subheader',
        alignment: 'center',
        margin: [0, 0, 0, 2],
      } as Content,
      {
        text: subtitle,
        style: 'subtitle',
        alignment: 'center',
        margin: [0, 0, 0, 16],
      } as Content,

      // Table
      {
        table: {
          headerRows: 1,
          widths: [50, 80, 60, 55, 95, 50, 50, 35, 60],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return '#1976D2';
            return rowIndex % 2 === 0 ? '#F5F5F5' : null;
          },
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#BDBDBD',
          vLineColor: () => '#BDBDBD',
        },
      } as Content,

      // Summary
      {
        text: 'Ringkasan',
        style: 'summaryHeader',
        margin: [0, 20, 0, 8],
      } as Content,
      {
        columns: [
          {
            width: 'auto',
            table: {
              body: [
                ['Total Karyawan', `${stats.totalEmployees}`],
                ['Total Hari Kerja', `${stats.totalWorkDays}`],
                ['Tepat Waktu', `${stats.tepatWaktu}`],
                ['Telat', `${stats.telat}`],
                ['Tidak Masuk', `${stats.tidakMasuk}`],
                ['Persentase Kehadiran', `${stats.attendancePercentage.toFixed(1)}%`],
              ],
            },
            layout: 'noBorders',
          },
        ],
      } as Content,
    ],

    styles: {
      header: { fontSize: 16, bold: true },
      subheader: { fontSize: 12, bold: true },
      subtitle: { fontSize: 9, italics: true, color: '#666666' },
      tableHeader: { fontSize: 8, bold: true, color: '#FFFFFF' },
      tableCell: { fontSize: 7 },
      summaryHeader: { fontSize: 11, bold: true },
    } as StyleDictionary,

    defaultStyle: {
      fontSize: 8,
    },
  };

  // Generate PDF buffer using pdfmake v0.3.x API
  const pdfDoc = pdfmake.createPdf(docDefinition);
  const buffer: Buffer = await pdfDoc.getBuffer();
  return buffer;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the subtitle string showing the report period.
 */
function buildSubtitle(records: AttendanceRecord[]): string {
  if (records.length === 0) {
    return 'Tidak ada data';
  }

  const dates = records.map((r) => r.tanggal).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  return `Periode: ${formatDateIndonesian(startDate)} - ${formatDateIndonesian(endDate)}`;
}

/**
 * Format a YYYY-MM-DD date string to DD/MM/YYYY (Indonesian format).
 */
export function formatDateIndonesian(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Compute summary statistics from attendance records.
 */
export function computeSummaryStats(records: AttendanceRecord[]): {
  totalEmployees: number;
  totalWorkDays: number;
  tepatWaktu: number;
  telat: number;
  tidakMasuk: number;
  attendancePercentage: number;
} {
  const uniqueEmployees = new Set(records.map((r) => r.kodeKaryawan));
  const uniqueDates = new Set(records.map((r) => r.tanggal));

  const tepatWaktu = records.filter((r) => r.status === 'Tepat Waktu').length;
  const telat = records.filter((r) => r.status === 'Telat').length;
  const tidakMasuk = records.filter((r) => r.status === 'Tidak Masuk').length;

  const totalRecords = records.length;
  const attendancePercentage =
    totalRecords > 0 ? ((tepatWaktu + telat) / totalRecords) * 100 : 0;

  return {
    totalEmployees: uniqueEmployees.size,
    totalWorkDays: uniqueDates.size,
    tepatWaktu,
    telat,
    tidakMasuk,
    attendancePercentage,
  };
}

/**
 * Build the PDF table body (header + data rows) with color-coded status.
 */
function buildPdfTableBody(records: AttendanceRecord[]): unknown[][] {
  // Header row
  const header = REPORT_COLUMNS.map((col) => ({
    text: col,
    style: 'tableHeader',
    alignment: 'center' as const,
  }));

  // Data rows
  const dataRows = records.map((record) => [
    { text: record.kodeDealer, style: 'tableCell', alignment: 'center' as const },
    { text: record.namaDealer, style: 'tableCell' },
    { text: formatDateIndonesian(record.tanggal), style: 'tableCell', alignment: 'center' as const },
    { text: record.kodeKaryawan, style: 'tableCell', alignment: 'center' as const },
    { text: record.namaKaryawan, style: 'tableCell' },
    { text: record.jamMasuk ?? '-', style: 'tableCell', alignment: 'center' as const },
    { text: record.jamPulang ?? '-', style: 'tableCell', alignment: 'center' as const },
    { text: `${record.totalTap}`, style: 'tableCell', alignment: 'center' as const },
    {
      text: record.status,
      style: 'tableCell',
      alignment: 'center' as const,
      bold: true,
      fillColor: STATUS_COLORS_PDF[record.status] ?? null,
    },
  ]);

  return [header, ...dataRows];
}
