/**
 * Unit tests for the File Storage Service (tenant-isolated).
 *
 * Tests use a unique tenant slug prefix to avoid polluting real data.
 * After tests, the test directories are cleaned up.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  saveAttLogFile,
  getLatestFile,
  cleanupOldFiles,
  listFiles,
  archiveTenantFiles,
  restoreTenantFiles,
  generateFileName,
  parseDateFromFileName,
  getDataRoot,
  getBackupRoot,
  FileStorageError,
} from './file-storage';

/** Unique prefix for test tenants to avoid collisions. */
const TEST_PREFIX = `__test_${Date.now()}_`;
const testTenants: string[] = [];

function testSlug(name: string): string {
  const slug = `${TEST_PREFIX}${name}`;
  testTenants.push(slug);
  return slug;
}

describe('file-storage', () => {
  afterEach(async () => {
    // Clean up all test tenant directories
    for (const slug of testTenants) {
      const dataDir = path.resolve(getDataRoot(), slug);
      const backupDir = path.resolve(getBackupRoot(), slug);
      await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
    }
    testTenants.length = 0;
  });

  describe('generateFileName', () => {
    it('should generate filename with correct format', () => {
      const date = new Date(2026, 4, 18); // May 18, 2026
      const result = generateFileName('Simpang Rumbio', date);
      expect(result).toBe('Simpang Rumbio-18-05-2026.dat');
    });

    it('should pad single-digit day and month with zeros', () => {
      const date = new Date(2024, 0, 5); // Jan 5, 2024
      const result = generateFileName('TestBranch', date);
      expect(result).toBe('TestBranch-05-01-2024.dat');
    });

    it('should use current date when no date provided', () => {
      const result = generateFileName('Branch');
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = String(now.getFullYear());
      expect(result).toBe(`Branch-${dd}-${mm}-${yyyy}.dat`);
    });
  });

  describe('parseDateFromFileName', () => {
    it('should parse a valid filename date', () => {
      const result = parseDateFromFileName('Simpang Rumbio-18-05-2026.dat');
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(18);
      expect(result!.getMonth()).toBe(4); // 0-indexed
      expect(result!.getFullYear()).toBe(2026);
    });

    it('should return null for invalid filename format', () => {
      expect(parseDateFromFileName('random-file.txt')).toBeNull();
      expect(parseDateFromFileName('no-date.dat')).toBeNull();
    });

    it('should return null for invalid date values', () => {
      // Feb 30 doesn't exist
      expect(parseDateFromFileName('Branch-30-02-2024.dat')).toBeNull();
    });
  });

  describe('saveAttLogFile', () => {
    it('should save file in correct tenant-isolated path', async () => {
      const slug = testSlug('save-a');
      const content = '10021\t2026-04-10 17:08:59\t1\t0\t0\n';
      const date = new Date(2026, 3, 10); // April 10, 2026

      const filePath = await saveAttLogFile(slug, 'BranchX', content, date);

      expect(filePath).toContain(path.join('data', slug, 'BranchX'));
      expect(filePath).toContain('BranchX-10-04-2026.dat');

      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toBe(content);
    });

    it('should create directories if they do not exist', async () => {
      const slug = testSlug('save-b');
      const content = 'test content';
      const date = new Date(2024, 0, 1);

      const filePath = await saveAttLogFile(slug, 'NewBranch', content, date);

      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
    });
  });

  describe('listFiles', () => {
    it('should return empty array when branch directory does not exist', async () => {
      const slug = testSlug('list-a');
      const files = await listFiles(slug, 'NoBranch');
      expect(files).toEqual([]);
    });

    it('should list only .dat files', async () => {
      const slug = testSlug('list-b');
      // Create some files
      await saveAttLogFile(slug, 'Branch1', 'data1', new Date(2024, 0, 1));
      await saveAttLogFile(slug, 'Branch1', 'data2', new Date(2024, 0, 2));

      // Create a non-.dat file manually in the same directory
      const branchDir = path.resolve(getDataRoot(), slug, 'Branch1');
      await fs.writeFile(path.join(branchDir, 'readme.txt'), 'ignore me');

      const files = await listFiles(slug, 'Branch1');
      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith('.dat'))).toBe(true);
    });
  });

  describe('getLatestFile', () => {
    it('should return null when no files exist', async () => {
      const slug = testSlug('latest-a');
      const result = await getLatestFile(slug, 'NoBranch');
      expect(result).toBeNull();
    });

    it('should return the most recent file by date in filename', async () => {
      const slug = testSlug('latest-b');
      await saveAttLogFile(slug, 'BranchA', 'old', new Date(2024, 0, 1));
      await saveAttLogFile(slug, 'BranchA', 'mid', new Date(2024, 5, 15));
      await saveAttLogFile(slug, 'BranchA', 'new', new Date(2024, 11, 31));

      const latest = await getLatestFile(slug, 'BranchA');
      expect(latest).not.toBeNull();
      expect(path.basename(latest!)).toBe('BranchA-31-12-2024.dat');
    });
  });

  describe('cleanupOldFiles', () => {
    it('should delete files beyond keepCount, keeping newest', async () => {
      const slug = testSlug('cleanup-a');
      // Create 5 files
      for (let i = 1; i <= 5; i++) {
        await saveAttLogFile(slug, 'BranchB', `data${i}`, new Date(2024, 0, i));
      }

      const deleted = await cleanupOldFiles(slug, 'BranchB', 3);
      expect(deleted).toBe(2);

      const remaining = await listFiles(slug, 'BranchB');
      expect(remaining).toHaveLength(3);

      // Verify the newest 3 are kept (Jan 3, 4, 5)
      const basenames = remaining.map((f) => path.basename(f)).sort();
      expect(basenames).toContain('BranchB-03-01-2024.dat');
      expect(basenames).toContain('BranchB-04-01-2024.dat');
      expect(basenames).toContain('BranchB-05-01-2024.dat');
    });

    it('should return 0 when files are within keepCount', async () => {
      const slug = testSlug('cleanup-b');
      await saveAttLogFile(slug, 'BranchC', 'data1', new Date(2024, 0, 1));
      await saveAttLogFile(slug, 'BranchC', 'data2', new Date(2024, 0, 2));

      const deleted = await cleanupOldFiles(slug, 'BranchC', 3);
      expect(deleted).toBe(0);
    });

    it('should return 0 when branch does not exist', async () => {
      const slug = testSlug('cleanup-c');
      const deleted = await cleanupOldFiles(slug, 'NoBranch', 3);
      expect(deleted).toBe(0);
    });
  });

  describe('tenant isolation', () => {
    it('should not allow one tenant to access another tenant files', async () => {
      const slugX = testSlug('iso-x');
      const slugY = testSlug('iso-y');
      await saveAttLogFile(slugX, 'Branch1', 'secret-x', new Date(2024, 0, 1));
      await saveAttLogFile(slugY, 'Branch1', 'secret-y', new Date(2024, 0, 1));

      const filesX = await listFiles(slugX, 'Branch1');
      const filesY = await listFiles(slugY, 'Branch1');

      // Each tenant only sees their own files
      expect(filesX).toHaveLength(1);
      expect(filesY).toHaveLength(1);
      expect(filesX[0]).toContain(slugX);
      expect(filesY[0]).toContain(slugY);
    });
  });

  describe('archiveTenantFiles', () => {
    it('should move tenant data to backup directory', async () => {
      const slug = testSlug('archive-a');
      await saveAttLogFile(slug, 'Branch1', 'data', new Date(2024, 0, 1));

      await archiveTenantFiles(slug);

      // Original directory should no longer exist
      const tenantDir = path.resolve(getDataRoot(), slug);
      const exists = await fs.access(tenantDir).then(() => true).catch(() => false);
      expect(exists).toBe(false);

      // Backup directory should exist
      const backupDir = path.resolve(getBackupRoot(), slug);
      const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should not throw when tenant has no data', async () => {
      const slug = testSlug('archive-b');
      await expect(archiveTenantFiles(slug)).resolves.not.toThrow();
    });
  });

  describe('restoreTenantFiles', () => {
    it('should restore archived files back to data directory', async () => {
      const slug = testSlug('restore-a');
      // Save, archive, then restore
      await saveAttLogFile(slug, 'Branch1', 'restored-data', new Date(2024, 0, 1));
      await archiveTenantFiles(slug);

      await restoreTenantFiles(slug);

      const files = await listFiles(slug, 'Branch1');
      expect(files).toHaveLength(1);

      const content = await fs.readFile(files[0], 'utf-8');
      expect(content).toBe('restored-data');
    });

    it('should throw when no backup exists', async () => {
      const slug = testSlug('restore-b');
      await expect(restoreTenantFiles(slug)).rejects.toThrow(FileStorageError);
    });
  });
});
