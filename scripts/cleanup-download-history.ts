/**
 * Cleanup old DownloadHistory records across all tenants.
 *
 * Removes entries older than DOWNLOAD_HISTORY_RETENTION_DAYS (default 90).
 *
 * Usage: npx tsx scripts/cleanup-download-history.ts
 */
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient as TenantPrisma } from '../src/generated/tenant';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const PROJECT_ROOT = process.cwd();
const TENANTS_DIR = path.resolve(PROJECT_ROOT, 'databases', 'tenants');
const RETENTION_DAYS = parseInt(process.env.DOWNLOAD_HISTORY_RETENTION_DAYS || '90', 10);

async function cleanupTenant(tenantFile: string): Promise<number> {
  const fullPath = path.join(TENANTS_DIR, tenantFile);
  const adapter = new PrismaBetterSqlite3({ url: `file:${fullPath}` });
  const db = new TenantPrisma({ adapter });

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await db.downloadHistory.deleteMany({
      where: { completedAt: { lt: cutoff } },
    });
    return result.count;
  } finally {
    await db.$disconnect();
  }
}

async function main(): Promise<void> {
  if (!fs.existsSync(TENANTS_DIR)) {
    console.log('No tenants directory found, skipping.');
    return;
  }

  const tenantFiles = fs.readdirSync(TENANTS_DIR).filter((f) => f.endsWith('.sqlite'));
  console.log(`Cleaning download history older than ${RETENTION_DAYS} days from ${tenantFiles.length} tenant(s)...`);

  let total = 0;
  for (const file of tenantFiles) {
    try {
      const removed = await cleanupTenant(file);
      console.log(`  ${file}: removed ${removed} records`);
      total += removed;
    } catch (err) {
      console.error(`  ${file}: ERROR — ${(err as Error).message}`);
    }
  }

  console.log(`Total removed: ${total} records.`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
