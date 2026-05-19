/**
 * Cleanup orphan tenant records that have no DB file.
 * Run via: npx tsx scripts/cleanup-orphan-tenant.ts <slug>
 */
import { PrismaClient } from '../src/generated/master';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(__dirname, '../databases/master.sqlite');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npx tsx scripts/cleanup-orphan-tenant.ts <slug>');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.log(`No tenant found with slug "${slug}"`);
    return;
  }

  const tenantDbPath = path.resolve(__dirname, `../databases/tenants/${slug}.sqlite`);
  const dbExists = fs.existsSync(tenantDbPath);

  console.log(`Tenant: ${tenant.companyName} (id=${tenant.id})`);
  console.log(`DB file exists: ${dbExists}`);

  if (!dbExists) {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    console.log(`✓ Deleted orphan tenant record for "${slug}"`);
  } else {
    console.log(`Tenant has a DB file — not orphan, skipping.`);
  }
}

main().finally(() => prisma.$disconnect());
