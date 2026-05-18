/**
 * Unit tests for the att_log.dat parser in report-generator.ts
 *
 * @see Requirements 5.4, 5.5
 */

import { describe, it, expect } from 'vitest';
import { parseAttLogContent } from './report-generator';

describe('parseAttLogContent', () => {
  it('should parse a valid 5-column line', () => {
    const content = '10021\t2026-04-10 17:08:59\t1\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const entry = result.entries[0];
    expect(entry.id).toBe('10021');
    expect(entry.datetime).toEqual(new Date(2026, 3, 10, 17, 8, 59));
    expect(entry.status1).toBe(1);
    expect(entry.status2).toBe(0);
    expect(entry.status3).toBe(0);
  });

  it('should parse a valid 11-column line', () => {
    const content = '22592\t2023-03-29 17:29:16\t1\t255\t1\t0\t0\t0\t0\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const entry = result.entries[0];
    expect(entry.id).toBe('22592');
    expect(entry.datetime).toEqual(new Date(2023, 2, 29, 17, 29, 16));
    expect(entry.status1).toBe(1);
    expect(entry.status2).toBe(255);
    expect(entry.status3).toBe(1);
  });

  it('should parse multiple lines', () => {
    const content = [
      '10021\t2026-04-10 17:08:59\t1\t0\t0',
      '24387\t2026-04-10 17:33:57\t1\t0\t0',
      '24388\t2026-04-10 17:34:22\t1\t0\t0',
    ].join('\n');

    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.entries[0].id).toBe('10021');
    expect(result.entries[1].id).toBe('24387');
    expect(result.entries[2].id).toBe('24388');
  });

  it('should skip empty lines', () => {
    const content = [
      '10021\t2026-04-10 17:08:59\t1\t0\t0',
      '',
      '24387\t2026-04-10 17:33:57\t1\t0\t0',
      '   ',
      '',
    ].join('\n');

    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle Windows-style line endings (\\r\\n)', () => {
    const content = '10021\t2026-04-10 17:08:59\t1\t0\t0\r\n24387\t2026-04-10 17:33:57\t1\t0\t0\r\n';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle BOM character at start of file', () => {
    const content = '\uFEFF10021\t2026-04-10 17:08:59\t1\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.entries[0].id).toBe('10021');
  });

  it('should report error for lines with too few columns', () => {
    const content = '10021\t2026-04-10 17:08:59\t1';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(1);
    expect(result.errors[0].reason).toContain('at least 5');
  });

  it('should report error for invalid datetime format', () => {
    const content = '10021\t2026-13-10 17:08:59\t1\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('Invalid datetime');
  });

  it('should report error for non-integer status fields', () => {
    const content = '10021\t2026-04-10 17:08:59\tabc\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('Invalid status');
  });

  it('should report error for empty employee ID', () => {
    const content = '\t2026-04-10 17:08:59\t1\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('Empty employee ID');
  });

  it('should handle mixed valid and invalid lines', () => {
    const content = [
      '10021\t2026-04-10 17:08:59\t1\t0\t0',
      'bad line without tabs',
      '24387\t2026-04-10 17:33:57\t1\t0\t0',
      '10021\tinvalid-date\t1\t0\t0',
    ].join('\n');

    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].line).toBe(2);
    expect(result.errors[1].line).toBe(4);
  });

  it('should return empty result for empty content', () => {
    const result = parseAttLogContent('');

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle single-digit employee IDs', () => {
    const content = '2\t2024-03-15 08:57:49\t1\t255\t1\t0\t0\t0\t0\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('2');
  });

  it('should reject invalid dates like Feb 30', () => {
    const content = '10021\t2026-02-30 08:00:00\t1\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('Invalid datetime');
  });

  it('should handle status2 value of 255 (common in real data)', () => {
    const content = '23118\t2023-03-29 17:31:50\t1\t255\t1\t0\t0\t0\t0\t0\t0';
    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].status2).toBe(255);
  });

  it('should handle various status2 values seen in real data', () => {
    const content = [
      '24117\t2026-04-27 14:28:30\t1\t3\t0',
      '23923\t2026-05-13 08:02:28\t1\t4\t0',
      '10021\t2026-04-15 07:38:49\t1\t1\t0',
    ].join('\n');

    const result = parseAttLogContent(content);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].status2).toBe(3);
    expect(result.entries[1].status2).toBe(4);
    expect(result.entries[2].status2).toBe(1);
  });
});
