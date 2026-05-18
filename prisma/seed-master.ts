/**
 * Master Database Seed Script
 *
 * Seeds the platform master database with:
 * - Platform Owner account (configurable via env vars)
 * - First tenant: CV TJAHAJA BARU (slug: tjahaja-baru)
 *
 * Usage: npx ts-node prisma/seed-master.ts
 *
 * @see Requirements 18.4, 18.5
 */

import { PrismaClient } from '../src/generated/master';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.resolve(__dirname, '../databases/master.sqlite');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding master database...');

  // 1. Create Platform Owner
  const ownerUsername = process.env.OWNER_USERNAME ?? 'admin';
  const ownerPassword = process.env.OWNER_PASSWORD ?? 'admin123456';
  const ownerHash = await bcrypt.hash(ownerPassword, 10);

  const owner = await prisma.platformOwner.upsert({
    where: { username: ownerUsername },
    update: { passwordHash: ownerHash },
    create: {
      username: ownerUsername,
      passwordHash: ownerHash,
    },
  });
  console.log(`  ✓ Platform Owner: ${owner.username}`);

  // 2. Create first tenant: CV TJAHAJA BARU
  const tenantPassword = process.env.TENANT_ADMIN_PASSWORD ?? 'tjahaja123';
  const tenantHash = await bcrypt.hash(tenantPassword, 10);

  const trialStart = new Date();
  const trialExpiry = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'tjahaja-baru' },
    update: {},
    create: {
      companyName: 'CV TJAHAJA BARU',
      slug: 'tjahaja-baru',
      adminEmail: 'admin@tjahajabaru.com',
      adminPasswordHash: tenantHash,
      licenseCode: generateLicenseCode(),
      subscriptionStatus: 'trial',
      trialStartedAt: trialStart,
      subscriptionExpiresAt: trialExpiry,
      dbPath: 'databases/tenants/tjahaja-baru.sqlite',
      isActivated: true,
    },
  });
  console.log(`  ✓ Tenant: ${tenant.companyName} (slug: ${tenant.slug})`);
  console.log(`    License Code: ${tenant.licenseCode}`);
  console.log(`    Trial expires: ${trialExpiry.toISOString()}`);

  console.log('\n✅ Master database seeded successfully.');
  console.log(`\n📋 Credentials:`);
  console.log(`   Platform Owner: ${ownerUsername} / ${ownerPassword}`);
  console.log(`   Tenant Portal:  admin@tjahajabaru.com / ${tenantPassword}`);
}

function generateLicenseCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
