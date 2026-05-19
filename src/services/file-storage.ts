/**
 * File Storage Service (Tenant-Isolated)
 *
 * Manages att_log.dat files in a tenant-isolated directory structure.
 * Each tenant's files are stored under `data/{tenantSlug}/{namaDealer}/`
 * with the naming convention `{namaDealer}-{DD}-{MM}-{YYYY}.dat`.
 *
 * Provides methods to save, read, list, delete, archive, and restore
 * files. Enforces tenant isolation by scoping all operations to the
 * tenant's directory — one tenant cannot access another's files.
 *
 * @see Requirements 5.2, 5.3, 12.5
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ROOT = process.cwd();

/** Root directory for tenant .dat file storage. */
const DATA_ROOT = path.resolve(PROJECT_ROOT, 'data');

/** Root directory for archived tenant files. */
const BACKUP_ROOT = path.resolve(PROJECT_ROOT, 'backups');

/** Default number of recent files to keep per branch. */
const DEFAULT_KEEP_COUNT = 3;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Validate that a path component doesn't contain dangerous characters.
 * Throws PATH_TRAVERSAL if the input has null bytes, control chars, or
 * Windows-reserved chars that could lead to unintended file paths.
 */
function assertSafePathComponent(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new FileStorageError(
      'PATH_TRAVERSAL',
      `Invalid ${label}: must be a non-empty string.`,
    );
  }
  // Reject null byte, path separators, and parent traversal
  if (
    value.includes('\0') ||
    value.includes('/') ||
    value.includes('\\') ||
    value === '.' ||
    value === '..'
  ) {
    throw new FileStorageError(
      'PATH_TRAVERSAL',
      `Invalid ${label}: contains forbidden characters.`,
    );
  }
}

/**
 * Resolve the absolute directory path for a tenant's branch files.
 * Validates that the resolved path stays within DATA_ROOT to prevent
 * path traversal attacks.
 */
function resolveBranchDir(tenantSlug: string, namaDealer: string): string {
  assertSafePathComponent(tenantSlug, 'tenantSlug');
  assertSafePathComponent(namaDealer, 'namaDealer');

  const resolved = path.resolve(DATA_ROOT, tenantSlug, namaDealer);
  const dataRootNormalized = path.resolve(DATA_ROOT);
  if (!resolved.startsWith(dataRootNormalized + path.sep) && resolved !== dataRootNormalized) {
    throw new FileStorageError(
      'PATH_TRAVERSAL',
      `Invalid path: resolved path escapes data root.`
    );
  }
  return resolved;
}

/**
 * Resolve the absolute directory path for a tenant's root data folder.
 */
function resolveTenantDir(tenantSlug: string): string {
  assertSafePathComponent(tenantSlug, 'tenantSlug');

  const resolved = path.resolve(DATA_ROOT, tenantSlug);
  const dataRootNormalized = path.resolve(DATA_ROOT);
  if (!resolved.startsWith(dataRootNormalized + path.sep) && resolved !== dataRootNormalized) {
    throw new FileStorageError(
      'PATH_TRAVERSAL',
      `Invalid path: resolved path escapes data root.`
    );
  }
  return resolved;
}

/**
 * Generate a filename following the convention: {namaDealer}-{DD}-{MM}-{YYYY}.dat
 */
function generateFileName(namaDealer: string, date?: Date): string {
  const d = date ?? new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${namaDealer}-${dd}-${mm}-${yyyy}.dat`;
}

/**
 * Parse a date from a filename following the convention: {namaDealer}-{DD}-{MM}-{YYYY}.dat
 * Returns null if the filename doesn't match the expected pattern.
 */
function parseDateFromFileName(fileName: string): Date | null {
  // Match the pattern: anything-DD-MM-YYYY.dat
  const match = fileName.match(/(\d{2})-(\d{2})-(\d{4})\.dat$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  // Validate the date is real
  if (
    date.getDate() !== Number(dd) ||
    date.getMonth() !== Number(mm) - 1 ||
    date.getFullYear() !== Number(yyyy)
  ) {
    return null;
  }
  return date;
}

// ============================================================================
// Core File Operations
// ============================================================================

/**
 * Save an att_log.dat file in the tenant-isolated directory.
 *
 * File is stored at: data/{tenantSlug}/{namaDealer}/{namaDealer}-{DD}-{MM}-{YYYY}.dat
 *
 * @param tenantSlug - The tenant's URL slug.
 * @param namaDealer - The branch/dealer name (used as subdirectory and filename prefix).
 * @param content - The raw att_log.dat file content.
 * @param date - Optional date for the filename (defaults to today).
 * @returns The absolute path to the saved file.
 */
export async function saveAttLogFile(
  tenantSlug: string,
  namaDealer: string,
  content: string,
  date?: Date,
): Promise<string> {
  const branchDir = resolveBranchDir(tenantSlug, namaDealer);
  await ensureDir(branchDir);

  const fileName = generateFileName(namaDealer, date);
  const filePath = path.resolve(branchDir, fileName);

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Get the path to the most recent .dat file for a tenant's branch.
 * "Most recent" is determined by the date encoded in the filename.
 *
 * @param tenantSlug - The tenant's URL slug.
 * @param namaDealer - The branch/dealer name.
 * @returns The absolute path to the latest file, or null if no files exist.
 */
export async function getLatestFile(
  tenantSlug: string,
  namaDealer: string,
): Promise<string | null> {
  const branchDir = resolveBranchDir(tenantSlug, namaDealer);

  if (!existsSync(branchDir)) {
    return null;
  }

  const files = await listFiles(tenantSlug, namaDealer);
  if (files.length === 0) {
    return null;
  }

  // Sort by parsed date descending, pick the most recent
  const filesWithDates = files
    .map((filePath) => ({
      filePath,
      date: parseDateFromFileName(path.basename(filePath)),
    }))
    .filter((entry): entry is { filePath: string; date: Date } => entry.date !== null);

  if (filesWithDates.length === 0) {
    return null;
  }

  filesWithDates.sort((a, b) => b.date.getTime() - a.date.getTime());
  return filesWithDates[0].filePath;
}

/**
 * Remove old .dat files for a branch, keeping only the N most recent.
 * Files are sorted by the date in their filename; oldest are deleted first.
 *
 * @param tenantSlug - The tenant's URL slug.
 * @param namaDealer - The branch/dealer name.
 * @param keepCount - Number of recent files to retain (default: 3).
 * @returns The number of files deleted.
 */
export async function cleanupOldFiles(
  tenantSlug: string,
  namaDealer: string,
  keepCount: number = DEFAULT_KEEP_COUNT,
): Promise<number> {
  const branchDir = resolveBranchDir(tenantSlug, namaDealer);

  if (!existsSync(branchDir)) {
    return 0;
  }

  const files = await listFiles(tenantSlug, namaDealer);
  if (files.length <= keepCount) {
    return 0;
  }

  // Sort by parsed date descending (newest first)
  const filesWithDates = files
    .map((filePath) => ({
      filePath,
      date: parseDateFromFileName(path.basename(filePath)),
    }))
    .filter((entry): entry is { filePath: string; date: Date } => entry.date !== null);

  filesWithDates.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Delete everything beyond keepCount
  const toDelete = filesWithDates.slice(keepCount);
  for (const entry of toDelete) {
    await fs.unlink(entry.filePath);
  }

  return toDelete.length;
}

/**
 * List all .dat files for a tenant's branch.
 *
 * @param tenantSlug - The tenant's URL slug.
 * @param namaDealer - The branch/dealer name.
 * @returns Array of absolute file paths to .dat files.
 */
export async function listFiles(
  tenantSlug: string,
  namaDealer: string,
): Promise<string[]> {
  const branchDir = resolveBranchDir(tenantSlug, namaDealer);

  if (!existsSync(branchDir)) {
    return [];
  }

  const entries = await fs.readdir(branchDir);
  return entries
    .filter((name) => name.endsWith('.dat'))
    .map((name) => path.resolve(branchDir, name));
}

// ============================================================================
// Archive & Restore (Tenant-Level)
// ============================================================================

/**
 * Archive all .dat files for a tenant to the backup directory.
 * Moves the entire tenant data folder to `backups/{tenantSlug}/data-{timestamp}/`.
 *
 * @param tenantSlug - The tenant's URL slug.
 */
export async function archiveTenantFiles(tenantSlug: string): Promise<void> {
  const tenantDir = resolveTenantDir(tenantSlug);

  if (!existsSync(tenantDir)) {
    // Nothing to archive
    return;
  }

  const tenantBackupDir = path.resolve(BACKUP_ROOT, tenantSlug);
  await ensureDir(tenantBackupDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = path.resolve(tenantBackupDir, `data-${timestamp}`);

  await fs.rename(tenantDir, destDir);
}

/**
 * Restore the most recent archived data files for a tenant.
 * Copies the latest `data-{timestamp}` backup back to the active
 * data directory.
 *
 * @param tenantSlug - The tenant's URL slug.
 */
export async function restoreTenantFiles(tenantSlug: string): Promise<void> {
  const tenantBackupDir = path.resolve(BACKUP_ROOT, tenantSlug);

  if (!existsSync(tenantBackupDir)) {
    throw new FileStorageError(
      'NO_BACKUP',
      `Cannot restore files for tenant "${tenantSlug}": no backup directory found.`
    );
  }

  const entries = await fs.readdir(tenantBackupDir);
  const dataBackups = entries
    .filter((name) => name.startsWith('data-'))
    .sort();

  if (dataBackups.length === 0) {
    throw new FileStorageError(
      'NO_BACKUP',
      `Cannot restore files for tenant "${tenantSlug}": no data backups found.`
    );
  }

  // Use the most recent backup (lexicographic sort = chronological for ISO timestamps)
  const latestBackup = dataBackups[dataBackups.length - 1];
  const sourcePath = path.resolve(tenantBackupDir, latestBackup);
  const destPath = resolveTenantDir(tenantSlug);

  // If active data directory exists, move it aside
  if (existsSync(destPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stashPath = path.resolve(tenantBackupDir, `data-pre-restore-${timestamp}`);
    await fs.rename(destPath, stashPath);
  }

  // Copy the backup to the active location
  await copyDirRecursive(sourcePath, destPath);
}

/**
 * Recursively copy a directory and its contents.
 */
async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.resolve(src, entry.name);
    const destPath = path.resolve(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Read the content of a specific .dat file.
 *
 * @param filePath - Absolute path to the file.
 * @returns The file content as a UTF-8 string.
 */
export async function readFile(filePath: string): Promise<string> {
  // Validate the path is within DATA_ROOT or BACKUP_ROOT
  const normalizedPath = path.resolve(filePath);
  const dataRootNormalized = path.resolve(DATA_ROOT);
  const backupRootNormalized = path.resolve(BACKUP_ROOT);

  if (
    !normalizedPath.startsWith(dataRootNormalized + path.sep) &&
    !normalizedPath.startsWith(backupRootNormalized + path.sep)
  ) {
    throw new FileStorageError(
      'PATH_TRAVERSAL',
      'Cannot read file outside of data or backup directories.'
    );
  }

  return fs.readFile(filePath, 'utf-8');
}

/**
 * Get the data root directory path (useful for tests and configuration).
 */
export function getDataRoot(): string {
  return DATA_ROOT;
}

/**
 * Get the backup root directory path (useful for tests and configuration).
 */
export function getBackupRoot(): string {
  return BACKUP_ROOT;
}

// ============================================================================
// Exported Helpers (for testing / external use)
// ============================================================================

export { generateFileName, parseDateFromFileName };

// ============================================================================
// Error Class
// ============================================================================

export type FileStorageErrorCode = 'PATH_TRAVERSAL' | 'NO_BACKUP' | 'FILE_NOT_FOUND';

/**
 * Typed error thrown by the file storage service for known failure modes.
 */
export class FileStorageError extends Error {
  public readonly code: FileStorageErrorCode;

  constructor(code: FileStorageErrorCode, message: string) {
    super(message);
    this.name = 'FileStorageError';
    this.code = code;
  }
}
