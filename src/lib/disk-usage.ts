/**
 * Disk usage helper for monitoring tenant data directory size.
 *
 * Used by health check and admin diagnostics endpoints.
 */

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();

export interface DirectorySize {
  path: string;
  bytes: number;
  fileCount: number;
}

/**
 * Recursively compute the total size of a directory.
 * Returns { bytes: 0, fileCount: 0 } if the directory does not exist.
 */
export function getDirectorySize(dir: string): DirectorySize {
  const result: DirectorySize = { path: dir, bytes: 0, fileCount: 0 };
  if (!fs.existsSync(dir)) return result;

  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          result.bytes += stat.size;
          result.fileCount += 1;
        } catch {
          // ignore stat errors
        }
      }
    }
  }
  return result;
}

export function getDataDirectorySize(): DirectorySize {
  return getDirectorySize(path.resolve(PROJECT_ROOT, 'data'));
}

export function getDatabasesDirectorySize(): DirectorySize {
  return getDirectorySize(path.resolve(PROJECT_ROOT, 'databases'));
}

export function getBackupsDirectorySize(): DirectorySize {
  return getDirectorySize(path.resolve(PROJECT_ROOT, 'backups'));
}

/** Format bytes to human readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
