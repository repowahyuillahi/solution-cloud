/**
 * Tenant Seed Script — CV TJAHAJA BARU
 *
 * Seeds the tenant database from the "Fingerprint (Update 04 Juni 2022).xlsx"
 * Excel file. Creates:
 * - Machines with kode dealer, nama dealer, serial number, password
 * - Employees with kode karyawan, nama karyawan, branch assignments
 * - Default Superadmin user
 * - Default BranchSchedule records
 *
 * Usage: npx ts-node prisma/seed-tenant-tjahaja.ts
 *
 * @see Requirements 3.1, 4.1, 7.6
 */

import { PrismaClient } from '../src/generated/tenant';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

// Dynamic import for exceljs
async function loadExcelJS() {
  const ExcelJS = await import('exceljs');
  return ExcelJS.default;
}

const DB_PATH = path.resolve(__dirname, '../databases/tenants/tjahaja-baru.sqlite');
const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding tenant database: tjahaja-baru...');

  // 1. Create default Superadmin user
  const adminPassword = process.env.TENANT_ADMIN_PASSWORD ?? 'admin123';
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { passwordHash: adminHash },
    create: {
      username: 'superadmin',
      passwordHash: adminHash,
      role: 'Superadmin',
      updatedAt: new Date(),
    },
  });
  console.log(`  ✓ User: ${admin.username} (${admin.role})`);

  // 2. Try to parse Excel file for machine and employee data
  const excelPath = path.resolve(__dirname, '../Fingerprint (Update 04 Juni 2022).xlsx');

  try {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    // Process machines from the first sheet or a "Mesin" sheet
    const machineSheet = workbook.getWorksheet('Mesin') ?? workbook.worksheets[0];
    if (machineSheet) {
      await seedMachinesFromSheet(machineSheet);
    }

    // Process employees from "Karyawan" sheet or second sheet
    const employeeSheet = workbook.getWorksheet('Karyawan') ?? workbook.worksheets[1];
    if (employeeSheet) {
      await seedEmployeesFromSheet(employeeSheet);
    }
  } catch (error) {
    console.log(`  ⚠ Could not read Excel file: ${(error as Error).message}`);
    console.log('  → Seeding with sample data instead...');
    await seedSampleData();
  }

  // 3. Create default branch schedules
  await seedDefaultSchedules();

  console.log('\n✅ Tenant database seeded successfully.');
  console.log(`\n📋 Credentials:`);
  console.log(`   Superadmin: superadmin / ${adminPassword}`);
}

async function seedMachinesFromSheet(sheet: any) {
  let count = 0;
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return; // Skip header
    // Expected columns: Kode Dealer, Nama Dealer, Serial Number, Password
  });

  // Process rows
  const rows: any[] = [];
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    rows.push(row);
  });

  for (const row of rows) {
    const kodeDealer = String(row.getCell(1).value ?? '').trim();
    const namaDealer = String(row.getCell(2).value ?? '').trim();
    const serialNumber = String(row.getCell(3).value ?? '').trim();
    const password = String(row.getCell(4).value ?? '').trim();

    if (!kodeDealer || !serialNumber) continue;

    try {
      await prisma.machine.upsert({
        where: { serialNumber },
        update: { namaDealer, password },
        create: {
          kodeDealer,
          namaDealer,
          serialNumber,
          password,
          connectionStatus: 'unknown',
          updatedAt: new Date(),
        },
      });
      count++;
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✓ Machines: ${count} seeded from Excel`);
}

async function seedEmployeesFromSheet(sheet: any) {
  let count = 0;
  const rows: any[] = [];
  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    rows.push(row);
  });

  for (const row of rows) {
    const kodeKaryawan = String(row.getCell(1).value ?? '').trim();
    const namaKaryawan = String(row.getCell(2).value ?? '').trim();
    const kodeDealer = String(row.getCell(3).value ?? '').trim();

    if (!kodeKaryawan || !namaKaryawan) continue;

    try {
      const employee = await prisma.employee.upsert({
        where: { kodeKaryawan },
        update: { namaKaryawan },
        create: {
          kodeKaryawan,
          namaKaryawan,
          updatedAt: new Date(),
        },
      });

      // Create branch assignment if kodeDealer is provided
      if (kodeDealer) {
        await prisma.branchAssignment.create({
          data: {
            employeeId: employee.id,
            kodeDealer,
          },
        }).catch(() => {}); // Skip if already exists
      }

      count++;
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✓ Employees: ${count} seeded from Excel`);
}

async function seedSampleData() {
  // Sample machines
  const machines = [
    { kodeDealer: 'SR', namaDealer: 'Simpang Rumbio', serialNumber: 'ABCD1234', password: 'pass123' },
    { kodeDealer: 'BT', namaDealer: 'Batusangkar', serialNumber: 'EFGH5678', password: 'pass456' },
  ];

  for (const m of machines) {
    await prisma.machine.upsert({
      where: { serialNumber: m.serialNumber },
      update: {},
      create: {
        ...m,
        connectionStatus: 'unknown',
        updatedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ Machines: ${machines.length} sample machines seeded`);

  // Sample employees
  const employees = [
    { kodeKaryawan: '001', namaKaryawan: 'Ahmad Fauzi', kodeDealer: 'SR' },
    { kodeKaryawan: '002', namaKaryawan: 'Budi Santoso', kodeDealer: 'SR' },
    { kodeKaryawan: '003', namaKaryawan: 'Citra Dewi', kodeDealer: 'BT' },
  ];

  for (const e of employees) {
    const emp = await prisma.employee.upsert({
      where: { kodeKaryawan: e.kodeKaryawan },
      update: {},
      create: {
        kodeKaryawan: e.kodeKaryawan,
        namaKaryawan: e.namaKaryawan,
        updatedAt: new Date(),
      },
    });

    await prisma.branchAssignment.create({
      data: { employeeId: emp.id, kodeDealer: e.kodeDealer },
    }).catch(() => {});
  }
  console.log(`  ✓ Employees: ${employees.length} sample employees seeded`);
}

async function seedDefaultSchedules() {
  const machines = await prisma.machine.findMany({
    select: { kodeDealer: true },
  });

  const uniqueDealers = [...new Set(machines.map((m) => m.kodeDealer))];
  let count = 0;

  for (const kodeDealer of uniqueDealers) {
    await prisma.branchSchedule.upsert({
      where: { kodeDealer },
      update: {},
      create: {
        kodeDealer,
        jamMasuk: '08:00',
        toleranceMinutes: 5,
        workDays: '1,2,3,4,5,6,7',
      },
    });
    count++;
  }
  console.log(`  ✓ Branch Schedules: ${count} default schedules created`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
