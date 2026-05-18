/**
 * Attendance Downloader Service
 *
 * Downloads att_log.dat files from ZKTeco fingerprint machines via
 * solutioncloud.co.id. Supports bulk downloading from multiple machines
 * with configurable concurrency, timeouts, and progress reporting.
 *
 * Flow per machine:
 * 1. POST to solutioncloud.co.id/sc_pro.asp with SN + password → session cookie
 * 2. GET solutioncloud.co.id/download.asp with session cookie → att_log.dat content
 * 3. Save file via file-storage service
 *
 * @see Requirements 5.1, 5.8, 5.10
 */

import axios from 'axios';
import { saveAttLogFile, cleanupOldFiles } from './file-storage';
import type { DownloadProgress, BulkDownloadResult } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** Base URL for solutioncloud.co.id */
const SOLUTIONCLOUD_BASE_URL = 'http://solutioncloud.co.id';

/** Login endpoint — POST with sn + pass fields */
const LOGIN_URL = `${SOLUTIONCLOUD_BASE_URL}/sc_pro.asp`;

/** Download endpoint — GET with session cookie */
const DOWNLOAD_URL = `${SOLUTIONCLOUD_BASE_URL}/download.asp`;

/** Timeout per machine in milliseconds (Requirement 5.8) */
const MACHINE_TIMEOUT_MS = 15_000;

/** Maximum concurrent downloads (Requirement 5.10) */
const CONCURRENCY_LIMIT = 5;

/** Number of recent files to keep per branch */
const FILES_TO_KEEP = 3;

// ============================================================================
// Types
// ============================================================================

/** Machine record as stored in the tenant database. */
export interface MachineRecord {
  id: number;
  kodeDealer: string;
  namaDealer: string;
  serialNumber: string;
  password: string;
}

/** Result of downloading from a single machine. */
export interface SingleDownloadResult {
  success: boolean;
  logsCount: number;
  error?: string;
}

// ============================================================================
// In-progress tracking (per tenant)
// ============================================================================

/**
 * Tracks which tenants currently have a bulk download in progress.
 * Prevents concurrent downloads for the same tenant (Requirement 5.7).
 */
const activeDownloads = new Set<string>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a bulk download is currently in progress for a tenant.
 *
 * @param tenantSlug - The tenant's URL slug.
 * @returns true if a download is currently running.
 */
export function isDownloadInProgress(tenantSlug: string): boolean {
  return activeDownloads.has(tenantSlug);
}

/**
 * Start a bulk download for all provided machines.
 *
 * Processes machines in batches with a concurrency limit of 5.
 * Reports progress per machine via the onProgress callback.
 * Prevents concurrent downloads for the same tenant.
 *
 * @param tenantSlug - The tenant's URL slug.
 * @param machines - Array of machine records to download from.
 * @param onProgress - Callback invoked for each machine as it completes.
 * @returns Aggregate result of the bulk download.
 * @throws Error if a download is already in progress for this tenant.
 */
export async function startBulkDownload(
  tenantSlug: string,
  machines: MachineRecord[],
  onProgress: (progress: DownloadProgress) => void,
): Promise<BulkDownloadResult> {
  if (activeDownloads.has(tenantSlug)) {
    throw new Error(`Bulk download already in progress for tenant "${tenantSlug}".`);
  }

  activeDownloads.add(tenantSlug);
  const startedAt = new Date();

  let successCount = 0;
  let failedCount = 0;
  let totalLogs = 0;

  try {
    // Process machines in chunks of CONCURRENCY_LIMIT
    for (let i = 0; i < machines.length; i += CONCURRENCY_LIMIT) {
      const chunk = machines.slice(i, i + CONCURRENCY_LIMIT);

      // Emit "processing" status for each machine in the chunk
      for (const machine of chunk) {
        onProgress({
          machineId: machine.id,
          kodeDealer: machine.kodeDealer,
          namaDealer: machine.namaDealer,
          status: 'processing',
        });
      }

      // Download all machines in the chunk concurrently
      const results = await Promise.allSettled(
        chunk.map((machine) => downloadSingleMachine(tenantSlug, machine)),
      );

      // Process results and emit progress
      for (let j = 0; j < results.length; j++) {
        const machine = chunk[j];
        const result = results[j];

        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          totalLogs += result.value.logsCount;
          onProgress({
            machineId: machine.id,
            kodeDealer: machine.kodeDealer,
            namaDealer: machine.namaDealer,
            status: 'success',
            logsCount: result.value.logsCount,
          });
        } else {
          failedCount++;
          const error =
            result.status === 'rejected'
              ? result.reason?.message ?? 'Unknown error'
              : result.value.error ?? 'Download failed';
          onProgress({
            machineId: machine.id,
            kodeDealer: machine.kodeDealer,
            namaDealer: machine.namaDealer,
            status: 'failed',
            error,
          });
        }
      }
    }

    const completedAt = new Date();

    return {
      totalMachines: machines.length,
      successCount,
      failedCount,
      totalLogs,
      startedAt,
      completedAt,
    };
  } finally {
    activeDownloads.delete(tenantSlug);
  }
}

/**
 * Download attendance data from a single machine.
 *
 * Steps:
 * 1. Login to solutioncloud.co.id with the machine's SN and password
 * 2. Download the att_log.dat content using the session cookie
 * 3. Save the file using the file-storage service
 * 4. Cleanup old files (keep only 3 most recent)
 *
 * @param tenantSlug - The tenant's URL slug.
 * @param machine - The machine record to download from.
 * @returns Result indicating success/failure and log count.
 */
export async function downloadSingleMachine(
  tenantSlug: string,
  machine: MachineRecord,
): Promise<SingleDownloadResult> {
  try {
    // Step 1: Login to solutioncloud.co.id
    const sessionCookie = await loginToSolutionCloud(
      machine.serialNumber,
      machine.password,
    );

    // Step 2: Download att_log.dat content
    const content = await downloadAttLog(sessionCookie);

    if (!content || content.trim().length === 0) {
      return {
        success: true,
        logsCount: 0,
      };
    }

    // Step 3: Count log lines (non-empty lines)
    const logsCount = countLogLines(content);

    // Step 4: Save file via file-storage service
    await saveAttLogFile(tenantSlug, machine.namaDealer, content);

    // Step 5: Cleanup old files (keep 3 most recent per branch)
    await cleanupOldFiles(tenantSlug, machine.namaDealer, FILES_TO_KEEP);

    return {
      success: true,
      logsCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      logsCount: 0,
      error: message,
    };
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Login to solutioncloud.co.id and retrieve the session cookie.
 *
 * POST http://solutioncloud.co.id/sc_pro.asp
 * Body: sn={serialNumber}&pass={password} (form-urlencoded)
 *
 * @param serialNumber - Machine serial number.
 * @param password - Machine password.
 * @returns The session cookie string for subsequent requests.
 * @throws Error if login fails or times out.
 */
async function loginToSolutionCloud(
  serialNumber: string,
  password: string,
): Promise<string> {
  const params = new URLSearchParams();
  params.append('sn', serialNumber);
  params.append('pass', password);

  const response = await axios.post(LOGIN_URL, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: MACHINE_TIMEOUT_MS,
    maxRedirects: 5,
    // We need to capture cookies from the response
    withCredentials: true,
    // Don't follow redirects automatically so we can capture Set-Cookie
    validateStatus: (status) => status >= 200 && status < 400,
  });

  // Extract Set-Cookie header
  const setCookieHeader = response.headers['set-cookie'];
  if (!setCookieHeader || setCookieHeader.length === 0) {
    // Some servers return cookies differently; try to proceed with empty cookie
    // The legacy code uses a simpler GET approach as fallback
    return '';
  }

  // Combine all cookies into a single cookie string
  const cookies = setCookieHeader
    .map((cookie: string) => cookie.split(';')[0])
    .join('; ');

  return cookies;
}

/**
 * Download the att_log.dat file content from solutioncloud.co.id.
 *
 * GET http://solutioncloud.co.id/download.asp
 * Uses the session cookie obtained from login.
 *
 * @param sessionCookie - Cookie string from the login response.
 * @returns The raw att_log.dat file content.
 * @throws Error if download fails or times out.
 */
async function downloadAttLog(sessionCookie: string): Promise<string> {
  const response = await axios.get(DOWNLOAD_URL, {
    headers: {
      Cookie: sessionCookie,
    },
    timeout: MACHINE_TIMEOUT_MS,
    responseType: 'text',
    // Accept any 2xx/3xx status
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const data = typeof response.data === 'string'
    ? response.data
    : String(response.data);

  // Clean any HTML tags that might be in the response (legacy behavior)
  return cleanResponseContent(data);
}

/**
 * Alternative download method using the legacy view.asp endpoint.
 * Used as a fallback when the login + download.asp flow doesn't work.
 *
 * GET http://solutioncloud.co.id/view.asp?sn={sn}&pwd={pwd}
 *
 * @param serialNumber - Machine serial number.
 * @param password - Machine password.
 * @returns The raw att_log.dat file content.
 */
export async function downloadViaViewEndpoint(
  serialNumber: string,
  password: string,
): Promise<string> {
  const url = `${SOLUTIONCLOUD_BASE_URL}/view.asp?sn=${encodeURIComponent(serialNumber)}&pwd=${encodeURIComponent(password)}`;

  const response = await axios.get(url, {
    timeout: MACHINE_TIMEOUT_MS,
    responseType: 'text',
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const data = typeof response.data === 'string'
    ? response.data
    : String(response.data);

  return cleanResponseContent(data);
}

/**
 * Clean response content by removing HTML tags and normalizing whitespace.
 * The solutioncloud server sometimes wraps data in HTML.
 *
 * @param raw - Raw response string.
 * @returns Cleaned content with only att_log data lines.
 */
function cleanResponseContent(raw: string): string {
  // Remove HTML tags (legacy behavior from bulk_downloader.js)
  let cleaned = raw.replace(/<[^>]+>/g, '\n');
  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Remove empty lines and trim
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.join('\n');
}

/**
 * Count the number of valid log lines in att_log.dat content.
 * A valid line matches the pattern: ID\tYYYY-MM-DD HH:MM:SS\tStatus1\tStatus2\tStatus3
 *
 * @param content - The att_log.dat file content.
 * @returns Number of valid log lines.
 */
function countLogLines(content: string): number {
  const lines = content.split('\n');
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Match att_log format: ID\tYYYY-MM-DD HH:MM:SS\tN\tN\tN
    if (isValidAttLogLine(trimmed)) {
      count++;
    }
  }

  return count;
}

/**
 * Check if a line matches the expected att_log.dat format.
 * Format: {ID}\t{YYYY-MM-DD HH:MM:SS}\t{status1}\t{status2}\t{status3}
 *
 * @param line - A single line from the att_log.dat file.
 * @returns true if the line is a valid attendance log entry.
 */
export function isValidAttLogLine(line: string): boolean {
  // Split by tab
  const parts = line.split('\t');
  if (parts.length < 5) return false;

  const [id, datetime, s1, s2, s3] = parts;

  // ID should be numeric (employee fingerprint code)
  if (!/^\d+$/.test(id.trim())) return false;

  // Datetime should match YYYY-MM-DD HH:MM:SS
  if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(datetime.trim())) return false;

  // Status fields should be single digits
  if (!/^\d$/.test(s1.trim())) return false;
  if (!/^\d$/.test(s2.trim())) return false;
  if (!/^\d$/.test(s3.trim())) return false;

  return true;
}

// ============================================================================
// Exported for testing
// ============================================================================

export {
  SOLUTIONCLOUD_BASE_URL,
  LOGIN_URL,
  DOWNLOAD_URL,
  MACHINE_TIMEOUT_MS,
  CONCURRENCY_LIMIT,
  FILES_TO_KEEP,
  cleanResponseContent,
  countLogLines,
};
