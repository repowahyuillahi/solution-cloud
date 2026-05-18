/**
 * Report Generator Service
 *
 * Handles parsing of att_log.dat files from ZKTeco fingerprint machines
 * and generating attendance reports.
 *
 * @see Requirements 5.4, 5.5, 6.1-6.12
 */

import type { AttLogEntry, AttendanceRecord, ReportFilter } from '@/types';
import { getTenantDb } from '@/lib/db-tenant';
import { getLatestFile, readFile as readStorageFile } from '@/services/file-storage';

// ============================================================================
// Types
// ============================================================================

/** Result of parsing an att_log.dat file, including any skipped lines. */
export interface ParseResult {
  entries: AttLogEntry[];
  /** Lines that could not be parsed (line number → raw content). */
  errors: Array<{ line: number; content: string; reason: string }>;
}

/** Schedule configuration for a branch. */
export interface BranchScheduleConfig {
  kodeDealer: string;
  jamMasuk: string; // HH:MM format
  toleranceMinutes: number;
  workDays: number[]; // 1=Monday, 7=Sunday
}

/** Employee info with branch assignments. */
export interface EmployeeInfo {
  kodeKaryawan: string;
  namaKaryawan: string;
  branches: string[]; // kodeDealer values
}

/** Machine/branch info. */
export interface BranchInfo {
  kodeDealer: string;
  namaDealer: string;
}

/** Default schedule values when no custom schedule is configured. */
export const DEFAULT_SCHEDULE: Omit<BranchScheduleConfig, 'kodeDealer'> = {
  jamMasuk: '08:00',
  toleranceMinutes: 5,
  workDays: [1, 2, 3, 4, 5, 6, 7], // Monday to Sunday
};

// ============================================================================
// att_log.dat Parser
// ============================================================================

/**
 * Parse the content of an att_log.dat file into structured AttLogEntry records.
 *
 * The att_log.dat format from ZKTeco machines is tab-separated with either
 * 5 or 11 columns:
 *   - 5-column:  ID\tYYYY-MM-DD HH:MM:SS\tStatus1\tStatus2\tStatus3
 *   - 11-column: ID\tYYYY-MM-DD HH:MM:SS\tStatus1\tStatus2\tStatus3\t0\t0\t0\t0\t0\t0
 *
 * This is a pure function that takes file content as a string and returns
 * parsed records. It handles:
 *   - Empty lines (skipped silently)
 *   - Lines with only whitespace (skipped silently)
 *   - Malformed lines (logged as errors, skipped gracefully)
 *   - Both \r\n and \n line endings
 *   - BOM characters at the start of the file
 *
 * @param content - Raw file content as a string
 * @returns ParseResult with entries and any parsing errors
 */
export function parseAttLogContent(content: string): ParseResult {
  const entries: AttLogEntry[] = [];
  const errors: ParseResult['errors'] = [];

  // Strip BOM if present (UTF-8 BOM: \uFEFF)
  const cleanContent = content.startsWith('\uFEFF') ? content.slice(1) : content;

  // Split into lines, handling both \r\n and \n
  const lines = cleanContent.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;

    // Skip empty lines (only whitespace)
    if (rawLine.trim() === '') {
      continue;
    }

    // Split by tab (use raw line to preserve leading/trailing fields)
    const parts = rawLine.split('\t');

    // Validate minimum column count (at least 5 columns required)
    if (parts.length < 5) {
      errors.push({
        line: lineNumber,
        content: rawLine,
        reason: `Expected at least 5 tab-separated columns, got ${parts.length}`,
      });
      continue;
    }

    // Parse ID (employee fingerprint code)
    const id = parts[0].trim();
    if (!id) {
      errors.push({
        line: lineNumber,
        content: rawLine,
        reason: 'Empty employee ID',
      });
      continue;
    }

    // Parse datetime (YYYY-MM-DD HH:MM:SS)
    const datetimeStr = parts[1].trim();
    const datetime = parseDatetime(datetimeStr);
    if (datetime === null) {
      errors.push({
        line: lineNumber,
        content: rawLine,
        reason: `Invalid datetime format: "${datetimeStr}"`,
      });
      continue;
    }

    // Parse status fields
    const status1 = parseIntSafe(parts[2].trim());
    const status2 = parseIntSafe(parts[3].trim());
    const status3 = parseIntSafe(parts[4].trim());

    if (status1 === null || status2 === null || status3 === null) {
      errors.push({
        line: lineNumber,
        content: rawLine,
        reason: 'Invalid status field (expected integer)',
      });
      continue;
    }

    entries.push({
      id,
      datetime,
      status1,
      status2,
      status3,
    });
  }

  return { entries, errors };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a datetime string in the format "YYYY-MM-DD HH:MM:SS".
 * Returns null if the format is invalid or the date is not a real date.
 */
function parseDatetime(str: string): Date | null {
  // Match YYYY-MM-DD HH:MM:SS format
  const match = str.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);

  // Basic range validation
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  // Create date and verify it's valid (handles things like Feb 30)
  const date = new Date(year, month - 1, day, hour, minute, second);

  // Verify the date components match (catches invalid dates like Feb 31)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date;
}

/**
 * Safely parse an integer string. Returns null if the string is not a valid integer.
 */
function parseIntSafe(str: string): number | null {
  if (!/^-?\d+$/.test(str)) {
    return null;
  }
  return parseInt(str, 10);
}


// ============================================================================
// Report Generation
// ============================================================================

/**
 * Determine the attendance status based on the employee's check-in time
 * compared to the branch schedule.
 *
 * Rules:
 * - If jamMasuk is null → "Tidak Masuk" (no tap recorded)
 * - If jamMasuk <= scheduleJamMasuk + tolerance → "Tepat Waktu"
 * - If jamMasuk > scheduleJamMasuk + tolerance → "Telat"
 *
 * @param jamMasuk - The employee's earliest tap time (HH:MM:SS format) or null
 * @param scheduleJamMasuk - The branch's configured start time (HH:MM format)
 * @param toleranceMinutes - Minutes of tolerance after scheduled start
 * @returns The attendance status
 */
export function determineStatus(
  jamMasuk: string | null,
  scheduleJamMasuk: string,
  toleranceMinutes: number,
): 'Tepat Waktu' | 'Telat' | 'Tidak Masuk' {
  if (jamMasuk === null) {
    return 'Tidak Masuk';
  }

  // Parse jamMasuk (HH:MM:SS)
  const tapMinutes = timeToMinutes(jamMasuk);
  // Parse schedule (HH:MM)
  const scheduleMinutes = timeToMinutes(scheduleJamMasuk);

  if (tapMinutes === null || scheduleMinutes === null) {
    return 'Tidak Masuk';
  }

  const deadline = scheduleMinutes + toleranceMinutes;

  if (tapMinutes <= deadline) {
    return 'Tepat Waktu';
  }

  return 'Telat';
}

/**
 * Convert a time string (HH:MM or HH:MM:SS) to total minutes since midnight.
 * Returns null if the format is invalid.
 */
export function timeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  // Convert to fractional minutes for precise comparison
  return hours * 60 + minutes + seconds / 60;
}

/**
 * Parse the workDays string (comma-separated day numbers) into an array.
 * Day numbers: 1=Monday, 2=Tuesday, ..., 7=Sunday
 */
export function parseWorkDays(workDaysStr: string): number[] {
  return workDaysStr
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 7);
}

/**
 * Get the ISO day of week (1=Monday, 7=Sunday) from a Date object.
 */
export function getIsoWeekday(date: Date): number {
  const day = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  return day === 0 ? 7 : day;
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a Date to HH:MM:SS string.
 */
export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Generate all dates in a range (inclusive).
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [];
  }

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Group AttLogEntry records by employee ID and date.
 * Returns a map: employeeId → date (YYYY-MM-DD) → list of entries
 */
export function groupEntriesByEmployeeAndDate(
  entries: AttLogEntry[],
): Map<string, Map<string, AttLogEntry[]>> {
  const grouped = new Map<string, Map<string, AttLogEntry[]>>();

  for (const entry of entries) {
    const dateStr = formatDate(entry.datetime);

    if (!grouped.has(entry.id)) {
      grouped.set(entry.id, new Map());
    }
    const employeeDates = grouped.get(entry.id)!;

    if (!employeeDates.has(dateStr)) {
      employeeDates.set(dateStr, []);
    }
    employeeDates.get(dateStr)!.push(entry);
  }

  return grouped;
}

/**
 * Compute jam masuk (earliest tap) and jam pulang (latest tap) from a list
 * of entries for a single employee on a single day.
 *
 * Rules:
 * - jam masuk = earliest tap time
 * - jam pulang = latest tap time (only if there are 2+ taps, otherwise null)
 */
export function computeTapTimes(entries: AttLogEntry[]): {
  jamMasuk: string | null;
  jamPulang: string | null;
  totalTap: number;
} {
  if (entries.length === 0) {
    return { jamMasuk: null, jamPulang: null, totalTap: 0 };
  }

  // Sort by datetime ascending
  const sorted = [...entries].sort(
    (a, b) => a.datetime.getTime() - b.datetime.getTime(),
  );

  const jamMasuk = formatTime(sorted[0].datetime);
  // Only set jam pulang if there are multiple taps
  const jamPulang = sorted.length > 1 ? formatTime(sorted[sorted.length - 1].datetime) : null;

  return {
    jamMasuk,
    jamPulang,
    totalTap: sorted.length,
  };
}

/**
 * Generate an attendance report for a tenant based on the filter criteria.
 *
 * This function:
 * 1. Reads the latest .dat files for each branch (or filtered branch)
 * 2. Parses the att_log content
 * 3. Matches employee IDs to employee records
 * 4. Computes jam masuk/pulang for each employee per day
 * 5. Determines attendance status based on branch schedule
 * 6. Marks absent employees (no tap on work days)
 * 7. Sorts results by kodeDealer → tanggal → namaKaryawan
 *
 * @param tenantSlug - The tenant's URL slug
 * @param filter - Date range and optional branch filter
 * @returns Array of AttendanceRecord sorted by kodeDealer, tanggal, namaKaryawan
 */
export async function generateReport(
  tenantSlug: string,
  filter: ReportFilter,
): Promise<AttendanceRecord[]> {
  const db = await getTenantDb(tenantSlug);

  // 1. Get machines (branches) — optionally filtered by kodeDealer
  const machines = await db.machine.findMany(
    filter.kodeDealer
      ? { where: { kodeDealer: filter.kodeDealer } }
      : undefined,
  );

  if (machines.length === 0) {
    return [];
  }

  // 2. Get all employees with their branch assignments
  const employees = await db.employee.findMany({
    include: { branchAssignments: true },
  });

  // Build lookup maps
  const employeeByKode = new Map<string, { namaKaryawan: string; branches: string[] }>();
  for (const emp of employees) {
    employeeByKode.set(emp.kodeKaryawan, {
      namaKaryawan: emp.namaKaryawan,
      branches: emp.branchAssignments.map((ba) => ba.kodeDealer),
    });
  }

  // 3. Get branch schedules
  const schedules = await db.branchSchedule.findMany();
  const scheduleByKodeDealer = new Map<string, BranchScheduleConfig>();
  for (const sched of schedules) {
    scheduleByKodeDealer.set(sched.kodeDealer, {
      kodeDealer: sched.kodeDealer,
      jamMasuk: sched.jamMasuk,
      toleranceMinutes: sched.toleranceMinutes,
      workDays: parseWorkDays(sched.workDays),
    });
  }

  // 4. Generate date range
  const dateRange = generateDateRange(filter.startDate, filter.endDate);
  if (dateRange.length === 0) {
    return [];
  }

  const records: AttendanceRecord[] = [];

  // 5. Process each branch
  for (const machine of machines) {
    const { kodeDealer, namaDealer } = machine;

    // Get schedule for this branch (or use default)
    const schedule = scheduleByKodeDealer.get(kodeDealer) ?? {
      kodeDealer,
      ...DEFAULT_SCHEDULE,
    };

    // Read and parse the latest .dat file for this branch
    const latestFilePath = await getLatestFile(tenantSlug, namaDealer);
    let allEntries: AttLogEntry[] = [];

    if (latestFilePath) {
      const content = await readStorageFile(latestFilePath);
      const parseResult = parseAttLogContent(content);
      allEntries = parseResult.entries;
    }

    // Filter entries to the date range
    const filteredEntries = allEntries.filter((entry) => {
      const entryDate = formatDate(entry.datetime);
      return entryDate >= filter.startDate && entryDate <= filter.endDate;
    });

    // Group entries by employee ID and date
    const grouped = groupEntriesByEmployeeAndDate(filteredEntries);

    // Get employees assigned to this branch
    const branchEmployees = employees.filter((emp) =>
      emp.branchAssignments.some((ba) => ba.kodeDealer === kodeDealer),
    );

    // 6. Process each date in the range
    for (const dateStr of dateRange) {
      const dateObj = new Date(dateStr + 'T00:00:00');
      const weekday = getIsoWeekday(dateObj);

      // Skip non-work days
      if (!schedule.workDays.includes(weekday)) {
        continue;
      }

      // Track which employee IDs we've already processed for this date
      const processedIds = new Set<string>();

      // Process employees assigned to this branch
      for (const emp of branchEmployees) {
        const employeeDates = grouped.get(emp.kodeKaryawan);
        const dayEntries = employeeDates?.get(dateStr) ?? [];
        const { jamMasuk, jamPulang, totalTap } = computeTapTimes(dayEntries);

        const status = determineStatus(
          jamMasuk,
          schedule.jamMasuk,
          schedule.toleranceMinutes,
        );

        records.push({
          kodeDealer,
          namaDealer,
          tanggal: dateStr,
          kodeKaryawan: emp.kodeKaryawan,
          namaKaryawan: emp.namaKaryawan,
          jamMasuk,
          jamPulang,
          totalTap,
          status,
        });

        processedIds.add(emp.kodeKaryawan);
      }

      // 7. Handle unmatched IDs — employees who tapped but aren't in the system
      // Check all entries for this date that belong to IDs not in branchEmployees
      const groupedEntries = Array.from(grouped.entries());
      for (const [employeeId, employeeDates] of groupedEntries) {
        if (processedIds.has(employeeId)) continue;

        const dayEntries = employeeDates.get(dateStr);
        if (!dayEntries || dayEntries.length === 0) continue;

        // Check if this employee is known at all
        const knownEmployee = employeeByKode.get(employeeId);
        const namaKaryawan = knownEmployee?.namaKaryawan ?? 'Tidak Ditemukan';

        const { jamMasuk, jamPulang, totalTap } = computeTapTimes(dayEntries);

        const status = determineStatus(
          jamMasuk,
          schedule.jamMasuk,
          schedule.toleranceMinutes,
        );

        records.push({
          kodeDealer,
          namaDealer,
          tanggal: dateStr,
          kodeKaryawan: employeeId,
          namaKaryawan,
          jamMasuk,
          jamPulang,
          totalTap,
          status,
        });

        processedIds.add(employeeId);
      }
    }
  }

  // 8. Sort results by kodeDealer → tanggal → namaKaryawan
  records.sort((a, b) => {
    if (a.kodeDealer !== b.kodeDealer) {
      return a.kodeDealer.localeCompare(b.kodeDealer);
    }
    if (a.tanggal !== b.tanggal) {
      return a.tanggal.localeCompare(b.tanggal);
    }
    return a.namaKaryawan.localeCompare(b.namaKaryawan);
  });

  return records;
}
