/**
 * Backup script for SQLite databases.
 *
 * Copies the master DB and all tenant DBs to backups/{date}/.
 * Designed to run from cron daily.
 *
 * Usage: npx tsx scripts/backup-databases.ts
 *
 * Optional env: BACKUP_RETENTION_DAYS (default 30)
 */
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const DATABASES_DIR = path.resolve(PROJECT_ROOT, 'databases');
const TENANTS_DIR = path.resolve(DATABASES_DIR, 'tenants');
const BACKUP_ROOT = path.resolve(PROJECT_ROOT, 'backups', 'db');

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

function timestamp(): string {
  const d = new Date();
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0')
  );
}

function copyIfExists(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function pruneOldBackups(): void {
  if (!fs.existsSync(BACKUP_ROOT)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(BACKUP_ROOT, entry.name);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`[prune] Removed old backup: ${entry.name}`);
    }
  }
}

function main(): void {
  const ts = timestamp();
  const destRoot = path.join(BACKUP_ROOT, ts);
  console.log(`[backup] Starting backup → ${destRoot}`);

  let count = 0;

  // Master DB
  const masterSrc = path.join(DATABASES_DIR, 'master.sqlite');
  const masterDest = path.join(destRoot, 'master.sqlite');
  if (copyIfExists(masterSrc, masterDest)) {
    console.log('[backup] master.sqlite copied');
    count++;
  }

  // Tenant DBs
  if (fs.existsSync(TENANTS_DIR)) {
    const tenantFiles = fs.readdirSync(TENANTS_DIR).filter((f) => f.endsWith('.sqlite'));
    for (const file of tenantFiles) {
      const src = path.join(TENANTS_DIR, file);
      const dest = path.join(destRoot, 'tenants', file);
      if (copyIfExists(src, dest)) {
        console.log(`[backup] tenants/${file} copied`);
        count++;
      }
    }
  }

  console.log(`[backup] Done. ${count} files backed up.`);

  pruneOldBackups();
}

main();
