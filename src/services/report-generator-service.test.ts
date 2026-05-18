/**
 * Unit tests for the report generator service functions.
 *
 * Tests the pure utility functions: determineStatus, timeToMinutes,
 * computeTapTimes, groupEntriesByEmployeeAndDate, generateDateRange,
 * parseWorkDays, getIsoWeekday, formatDate, formatTime.
 *
 * @see Requirements 6.1, 6.2, 6.3, 6.4, 6.8, 6.10, 6.11, 6.12, 7.6
 */

import { describe, it, expect } from 'vitest';
import {
  determineStatus,
  timeToMinutes,
  computeTapTimes,
  groupEntriesByEmployeeAndDate,
  generateDateRange,
  parseWorkDays,
  getIsoWeekday,
  formatDate,
  formatTime,
  DEFAULT_SCHEDULE,
} from './report-generator';
import type { AttLogEntry } from '@/types';

// ============================================================================
// determineStatus
// ============================================================================

describe('determineStatus', () => {
  it('should return "Tidak Masuk" when jamMasuk is null', () => {
    expect(determineStatus(null, '08:00', 5)).toBe('Tidak Masuk');
  });

  it('should return "Tepat Waktu" when jamMasuk is before schedule', () => {
    expect(determineStatus('07:30:00', '08:00', 5)).toBe('Tepat Waktu');
  });

  it('should return "Tepat Waktu" when jamMasuk equals schedule exactly', () => {
    expect(determineStatus('08:00:00', '08:00', 5)).toBe('Tepat Waktu');
  });

  it('should return "Tepat Waktu" when jamMasuk is within tolerance', () => {
    expect(determineStatus('08:04:00', '08:00', 5)).toBe('Tepat Waktu');
  });

  it('should return "Tepat Waktu" when jamMasuk is exactly at tolerance boundary', () => {
    expect(determineStatus('08:05:00', '08:00', 5)).toBe('Tepat Waktu');
  });

  it('should return "Telat" when jamMasuk exceeds tolerance', () => {
    expect(determineStatus('08:06:00', '08:00', 5)).toBe('Telat');
  });

  it('should return "Telat" when jamMasuk is significantly late', () => {
    expect(determineStatus('09:30:00', '08:00', 5)).toBe('Telat');
  });

  it('should handle zero tolerance', () => {
    expect(determineStatus('08:00:00', '08:00', 0)).toBe('Tepat Waktu');
    expect(determineStatus('08:00:01', '08:00', 0)).toBe('Telat');
  });

  it('should handle large tolerance', () => {
    expect(determineStatus('08:30:00', '08:00', 30)).toBe('Tepat Waktu');
    expect(determineStatus('08:31:00', '08:00', 30)).toBe('Telat');
  });

  it('should handle different schedule times', () => {
    expect(determineStatus('09:00:00', '09:00', 10)).toBe('Tepat Waktu');
    expect(determineStatus('09:11:00', '09:00', 10)).toBe('Telat');
  });
});

// ============================================================================
// timeToMinutes
// ============================================================================

describe('timeToMinutes', () => {
  it('should parse HH:MM format', () => {
    expect(timeToMinutes('08:00')).toBe(480);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('should parse HH:MM:SS format', () => {
    expect(timeToMinutes('08:00:00')).toBe(480);
    expect(timeToMinutes('08:00:30')).toBe(480.5);
    expect(timeToMinutes('08:05:00')).toBe(485);
  });

  it('should return null for invalid format', () => {
    expect(timeToMinutes('invalid')).toBeNull();
    expect(timeToMinutes('')).toBeNull();
    expect(timeToMinutes('25:00')).toBeNull();
    expect(timeToMinutes('08:60')).toBeNull();
  });
});

// ============================================================================
// computeTapTimes
// ============================================================================

describe('computeTapTimes', () => {
  it('should return null values for empty entries', () => {
    const result = computeTapTimes([]);
    expect(result.jamMasuk).toBeNull();
    expect(result.jamPulang).toBeNull();
    expect(result.totalTap).toBe(0);
  });

  it('should set jamMasuk and null jamPulang for single tap', () => {
    const entries: AttLogEntry[] = [
      { id: '001', datetime: new Date(2024, 0, 15, 8, 5, 0), status1: 1, status2: 0, status3: 0 },
    ];
    const result = computeTapTimes(entries);
    expect(result.jamMasuk).toBe('08:05:00');
    expect(result.jamPulang).toBeNull();
    expect(result.totalTap).toBe(1);
  });

  it('should compute earliest and latest for multiple taps', () => {
    const entries: AttLogEntry[] = [
      { id: '001', datetime: new Date(2024, 0, 15, 17, 0, 0), status1: 1, status2: 0, status3: 0 },
      { id: '001', datetime: new Date(2024, 0, 15, 8, 5, 0), status1: 1, status2: 0, status3: 0 },
      { id: '001', datetime: new Date(2024, 0, 15, 12, 30, 0), status1: 1, status2: 0, status3: 0 },
    ];
    const result = computeTapTimes(entries);
    expect(result.jamMasuk).toBe('08:05:00');
    expect(result.jamPulang).toBe('17:00:00');
    expect(result.totalTap).toBe(3);
  });

  it('should handle two taps correctly', () => {
    const entries: AttLogEntry[] = [
      { id: '001', datetime: new Date(2024, 0, 15, 8, 0, 0), status1: 1, status2: 0, status3: 0 },
      { id: '001', datetime: new Date(2024, 0, 15, 17, 30, 0), status1: 1, status2: 0, status3: 0 },
    ];
    const result = computeTapTimes(entries);
    expect(result.jamMasuk).toBe('08:00:00');
    expect(result.jamPulang).toBe('17:30:00');
    expect(result.totalTap).toBe(2);
  });
});

// ============================================================================
// groupEntriesByEmployeeAndDate
// ============================================================================

describe('groupEntriesByEmployeeAndDate', () => {
  it('should return empty map for empty entries', () => {
    const result = groupEntriesByEmployeeAndDate([]);
    expect(result.size).toBe(0);
  });

  it('should group entries by employee and date', () => {
    const entries: AttLogEntry[] = [
      { id: '001', datetime: new Date(2024, 0, 15, 8, 0, 0), status1: 1, status2: 0, status3: 0 },
      { id: '001', datetime: new Date(2024, 0, 15, 17, 0, 0), status1: 1, status2: 0, status3: 0 },
      { id: '001', datetime: new Date(2024, 0, 16, 8, 5, 0), status1: 1, status2: 0, status3: 0 },
      { id: '002', datetime: new Date(2024, 0, 15, 8, 10, 0), status1: 1, status2: 0, status3: 0 },
    ];

    const result = groupEntriesByEmployeeAndDate(entries);

    expect(result.size).toBe(2); // 2 employees
    expect(result.get('001')!.size).toBe(2); // 2 dates for employee 001
    expect(result.get('001')!.get('2024-01-15')!.length).toBe(2); // 2 taps on Jan 15
    expect(result.get('001')!.get('2024-01-16')!.length).toBe(1); // 1 tap on Jan 16
    expect(result.get('002')!.size).toBe(1); // 1 date for employee 002
  });
});

// ============================================================================
// generateDateRange
// ============================================================================

describe('generateDateRange', () => {
  it('should generate a single date for same start and end', () => {
    const result = generateDateRange('2024-01-15', '2024-01-15');
    expect(result).toEqual(['2024-01-15']);
  });

  it('should generate multiple dates', () => {
    const result = generateDateRange('2024-01-15', '2024-01-17');
    expect(result).toEqual(['2024-01-15', '2024-01-16', '2024-01-17']);
  });

  it('should return empty array for invalid dates', () => {
    expect(generateDateRange('invalid', '2024-01-15')).toEqual([]);
    expect(generateDateRange('2024-01-15', 'invalid')).toEqual([]);
  });

  it('should return empty array when start is after end', () => {
    expect(generateDateRange('2024-01-17', '2024-01-15')).toEqual([]);
  });
});

// ============================================================================
// parseWorkDays
// ============================================================================

describe('parseWorkDays', () => {
  it('should parse comma-separated day numbers', () => {
    expect(parseWorkDays('1,2,3,4,5')).toEqual([1, 2, 3, 4, 5]);
  });

  it('should parse full week', () => {
    expect(parseWorkDays('1,2,3,4,5,6,7')).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('should handle spaces', () => {
    expect(parseWorkDays('1, 2, 3')).toEqual([1, 2, 3]);
  });

  it('should filter invalid values', () => {
    expect(parseWorkDays('1,8,2,0,3')).toEqual([1, 2, 3]);
  });
});

// ============================================================================
// getIsoWeekday
// ============================================================================

describe('getIsoWeekday', () => {
  it('should return 1 for Monday', () => {
    // 2024-01-15 is a Monday
    expect(getIsoWeekday(new Date(2024, 0, 15))).toBe(1);
  });

  it('should return 7 for Sunday', () => {
    // 2024-01-14 is a Sunday
    expect(getIsoWeekday(new Date(2024, 0, 14))).toBe(7);
  });

  it('should return 5 for Friday', () => {
    // 2024-01-19 is a Friday
    expect(getIsoWeekday(new Date(2024, 0, 19))).toBe(5);
  });
});

// ============================================================================
// formatDate
// ============================================================================

describe('formatDate', () => {
  it('should format date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe('2024-01-15');
    expect(formatDate(new Date(2024, 11, 1))).toBe('2024-12-01');
  });
});

// ============================================================================
// formatTime
// ============================================================================

describe('formatTime', () => {
  it('should format time as HH:MM:SS', () => {
    expect(formatTime(new Date(2024, 0, 15, 8, 5, 30))).toBe('08:05:30');
    expect(formatTime(new Date(2024, 0, 15, 17, 0, 0))).toBe('17:00:00');
  });
});

// ============================================================================
// DEFAULT_SCHEDULE
// ============================================================================

describe('DEFAULT_SCHEDULE', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_SCHEDULE.jamMasuk).toBe('08:00');
    expect(DEFAULT_SCHEDULE.toleranceMinutes).toBe(5);
    expect(DEFAULT_SCHEDULE.workDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
