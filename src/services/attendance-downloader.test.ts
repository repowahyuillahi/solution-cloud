/**
 * Unit tests for the Attendance Downloader Service.
 *
 * Tests cover:
 * - Content cleaning (HTML removal, line normalization)
 * - Log line validation
 * - Log line counting
 * - Concurrency tracking (isDownloadInProgress)
 * - Bulk download orchestration (with mocked HTTP)
 * - Single machine download (with mocked HTTP)
 * - Error handling (timeouts, connection failures)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';

import {
  isDownloadInProgress,
  startBulkDownload,
  downloadSingleMachine,
  isValidAttLogLine,
  cleanResponseContent,
  countLogLines,
  CONCURRENCY_LIMIT,
  MACHINE_TIMEOUT_MS,
  FILES_TO_KEEP,
  type MachineRecord,
} from './attendance-downloader';

import { getDataRoot } from './file-storage';

// ============================================================================
// Mock axios
// ============================================================================

vi.mock('axios', () => {
  const mockAxios = {
    post: vi.fn(),
    get: vi.fn(),
  };
  return { default: mockAxios };
});

import axios from 'axios';
const mockedAxios = vi.mocked(axios);

// ============================================================================
// Test data
// ============================================================================

const SAMPLE_ATT_LOG = [
  '10021\t2026-04-10 17:08:59\t1\t0\t0',
  '24387\t2026-04-10 17:33:57\t1\t0\t0',
  '24388\t2026-04-10 17:34:22\t1\t0\t0',
  '10073\t2026-04-11 07:31:03\t1\t0\t0',
].join('\n');

const SAMPLE_MACHINE: MachineRecord = {
  id: 1,
  kodeDealer: 'DLR001',
  namaDealer: 'Test Branch',
  serialNumber: 'SN123456',
  password: 'pass123',
};

const TEST_TENANT = `__test_downloader_${Date.now()}`;

// ============================================================================
// Cleanup
// ============================================================================

afterEach(async () => {
  vi.restoreAllMocks();
  // Clean up test data directory
  const testDir = path.resolve(getDataRoot(), TEST_TENANT);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

// ============================================================================
// Tests: isValidAttLogLine
// ============================================================================

describe('isValidAttLogLine', () => {
  it('should return true for valid att_log lines', () => {
    expect(isValidAttLogLine('10021\t2026-04-10 17:08:59\t1\t0\t0')).toBe(true);
    expect(isValidAttLogLine('24387\t2026-04-10 17:33:57\t1\t0\t0')).toBe(true);
    expect(isValidAttLogLine('123\t2020-01-01 00:00:00\t0\t0\t0')).toBe(true);
  });

  it('should return false for lines with non-numeric ID', () => {
    expect(isValidAttLogLine('abc\t2026-04-10 17:08:59\t1\t0\t0')).toBe(false);
  });

  it('should return false for lines with invalid datetime format', () => {
    expect(isValidAttLogLine('10021\t2026/04/10 17:08:59\t1\t0\t0')).toBe(false);
    expect(isValidAttLogLine('10021\t10-04-2026 17:08:59\t1\t0\t0')).toBe(false);
  });

  it('should return false for lines with too few columns', () => {
    expect(isValidAttLogLine('10021\t2026-04-10 17:08:59')).toBe(false);
    expect(isValidAttLogLine('10021')).toBe(false);
  });

  it('should return false for empty lines', () => {
    expect(isValidAttLogLine('')).toBe(false);
  });

  it('should return false for lines with non-digit status fields', () => {
    expect(isValidAttLogLine('10021\t2026-04-10 17:08:59\ta\t0\t0')).toBe(false);
    expect(isValidAttLogLine('10021\t2026-04-10 17:08:59\t1\tb\t0')).toBe(false);
  });
});

// ============================================================================
// Tests: cleanResponseContent
// ============================================================================

describe('cleanResponseContent', () => {
  it('should remove HTML tags from response', () => {
    const html = '<html><body>10021\t2026-04-10 17:08:59\t1\t0\t0</body></html>';
    const result = cleanResponseContent(html);
    expect(result).toBe('10021\t2026-04-10 17:08:59\t1\t0\t0');
  });

  it('should normalize line endings', () => {
    const content = '10021\t2026-04-10 17:08:59\t1\t0\t0\r\n24387\t2026-04-10 17:33:57\t1\t0\t0';
    const result = cleanResponseContent(content);
    expect(result).toContain('10021\t2026-04-10 17:08:59\t1\t0\t0');
    expect(result).toContain('24387\t2026-04-10 17:33:57\t1\t0\t0');
    expect(result).not.toContain('\r');
  });

  it('should remove empty lines', () => {
    const content = '10021\t2026-04-10 17:08:59\t1\t0\t0\n\n\n24387\t2026-04-10 17:33:57\t1\t0\t0';
    const result = cleanResponseContent(content);
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
  });

  it('should handle content wrapped in multiple HTML tags', () => {
    const html = '<pre><code>10021\t2026-04-10 17:08:59\t1\t0\t0</code></pre>';
    const result = cleanResponseContent(html);
    expect(result).toBe('10021\t2026-04-10 17:08:59\t1\t0\t0');
  });
});

// ============================================================================
// Tests: countLogLines
// ============================================================================

describe('countLogLines', () => {
  it('should count valid log lines', () => {
    expect(countLogLines(SAMPLE_ATT_LOG)).toBe(4);
  });

  it('should return 0 for empty content', () => {
    expect(countLogLines('')).toBe(0);
  });

  it('should skip invalid lines', () => {
    const mixed = [
      '10021\t2026-04-10 17:08:59\t1\t0\t0',
      'invalid line here',
      '24387\t2026-04-10 17:33:57\t1\t0\t0',
    ].join('\n');
    expect(countLogLines(mixed)).toBe(2);
  });

  it('should skip empty lines', () => {
    const withBlanks = '10021\t2026-04-10 17:08:59\t1\t0\t0\n\n\n';
    expect(countLogLines(withBlanks)).toBe(1);
  });
});

// ============================================================================
// Tests: isDownloadInProgress
// ============================================================================

describe('isDownloadInProgress', () => {
  it('should return false when no download is active', () => {
    expect(isDownloadInProgress('some-tenant')).toBe(false);
  });
});

// ============================================================================
// Tests: Constants
// ============================================================================

describe('constants', () => {
  it('should have correct concurrency limit', () => {
    expect(CONCURRENCY_LIMIT).toBe(5);
  });

  it('should have correct timeout', () => {
    expect(MACHINE_TIMEOUT_MS).toBe(15_000);
  });

  it('should keep 3 files per branch', () => {
    expect(FILES_TO_KEEP).toBe(3);
  });
});

// ============================================================================
// Tests: downloadSingleMachine (with mocked HTTP)
// ============================================================================

describe('downloadSingleMachine', () => {
  it('should successfully download and save att_log data', async () => {
    // Mock login response with session cookie
    mockedAxios.post.mockResolvedValueOnce({
      headers: {
        'set-cookie': ['ASPSESSIONID=abc123; path=/'],
      },
      data: 'OK',
    });

    // Mock download response with att_log content
    mockedAxios.get.mockResolvedValueOnce({
      data: SAMPLE_ATT_LOG,
    });

    const result = await downloadSingleMachine(TEST_TENANT, SAMPLE_MACHINE);

    expect(result.success).toBe(true);
    expect(result.logsCount).toBe(4);
    expect(result.error).toBeUndefined();

    // Verify login was called with correct params
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const postCall = mockedAxios.post.mock.calls[0];
    expect(postCall[1]).toContain('sn=SN123456');
    expect(postCall[1]).toContain('pass=pass123');

    // Verify download was called with session cookie
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    const getCall = mockedAxios.get.mock.calls[0];
    expect(getCall[1]?.headers?.Cookie).toContain('ASPSESSIONID=abc123');
  });

  it('should return success with 0 logs for empty response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      headers: { 'set-cookie': ['SID=x; path=/'] },
      data: 'OK',
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: '',
    });

    const result = await downloadSingleMachine(TEST_TENANT, SAMPLE_MACHINE);

    expect(result.success).toBe(true);
    expect(result.logsCount).toBe(0);
  });

  it('should return failure when login throws an error', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await downloadSingleMachine(TEST_TENANT, SAMPLE_MACHINE);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection timeout');
    expect(result.logsCount).toBe(0);
  });

  it('should return failure when download throws an error', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      headers: { 'set-cookie': ['SID=x; path=/'] },
      data: 'OK',
    });

    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const result = await downloadSingleMachine(TEST_TENANT, SAMPLE_MACHINE);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

// ============================================================================
// Tests: startBulkDownload (with mocked HTTP)
// ============================================================================

describe('startBulkDownload', () => {
  const machines: MachineRecord[] = [
    { id: 1, kodeDealer: 'DLR001', namaDealer: 'Branch A', serialNumber: 'SN001', password: 'p1' },
    { id: 2, kodeDealer: 'DLR002', namaDealer: 'Branch B', serialNumber: 'SN002', password: 'p2' },
    { id: 3, kodeDealer: 'DLR003', namaDealer: 'Branch C', serialNumber: 'SN003', password: 'p3' },
  ];

  it('should process all machines and report progress', async () => {
    // Mock all login + download calls
    mockedAxios.post.mockResolvedValue({
      headers: { 'set-cookie': ['SID=x; path=/'] },
      data: 'OK',
    });
    mockedAxios.get.mockResolvedValue({
      data: SAMPLE_ATT_LOG,
    });

    const progressEvents: any[] = [];
    const onProgress = (p: any) => progressEvents.push(p);

    const result = await startBulkDownload(TEST_TENANT, machines, onProgress);

    expect(result.totalMachines).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.totalLogs).toBe(12); // 4 logs × 3 machines
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);

    // Should have progress events for each machine (processing + final status)
    const successEvents = progressEvents.filter((e) => e.status === 'success');
    expect(successEvents.length).toBe(3);
  });

  it('should handle mixed success and failure', async () => {
    // First machine succeeds, second fails, third succeeds
    mockedAxios.post
      .mockResolvedValueOnce({ headers: { 'set-cookie': ['SID=x; path=/'] }, data: 'OK' })
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ headers: { 'set-cookie': ['SID=x; path=/'] }, data: 'OK' });

    mockedAxios.get
      .mockResolvedValueOnce({ data: SAMPLE_ATT_LOG })
      .mockResolvedValueOnce({ data: SAMPLE_ATT_LOG });

    const progressEvents: any[] = [];
    const result = await startBulkDownload(TEST_TENANT, machines, (p) => progressEvents.push(p));

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.totalLogs).toBe(8); // 4 logs × 2 successful machines

    const failedEvents = progressEvents.filter((e) => e.status === 'failed');
    expect(failedEvents.length).toBe(1);
    expect(failedEvents[0].error).toBe('Timeout');
  });

  it('should prevent concurrent downloads for the same tenant', async () => {
    const uniqueTenant = `__test_concurrent_${Date.now()}`;

    // Mock slow responses
    mockedAxios.post.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        headers: { 'set-cookie': ['SID=x; path=/'] },
        data: 'OK',
      }), 50)),
    );
    mockedAxios.get.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: SAMPLE_ATT_LOG }), 50)),
    );

    // Start first download (don't await)
    const firstDownload = startBulkDownload(uniqueTenant, [machines[0]], () => {});

    // Try to start second download immediately
    await expect(
      startBulkDownload(uniqueTenant, [machines[1]], () => {}),
    ).rejects.toThrow('already in progress');

    // Wait for first to complete
    await firstDownload;

    // Clean up
    const testDir = path.resolve(getDataRoot(), uniqueTenant);
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should release lock after download completes (even on error)', async () => {
    const uniqueTenant = `__test_lock_release_${Date.now()}`;

    // Make all requests fail
    mockedAxios.post.mockRejectedValue(new Error('Network down'));

    const result = await startBulkDownload(uniqueTenant, [machines[0]], () => {});

    expect(result.failedCount).toBe(1);
    // Lock should be released
    expect(isDownloadInProgress(uniqueTenant)).toBe(false);
  });

  it('should handle empty machine list', async () => {
    const result = await startBulkDownload(TEST_TENANT, [], () => {});

    expect(result.totalMachines).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.totalLogs).toBe(0);
  });
});
