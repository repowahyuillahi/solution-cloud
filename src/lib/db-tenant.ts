/**
 * Tenant Database Connection Pool
 *
 * Manages dynamic per-tenant SQLite connections with an LRU connection
 * pool. Each tenant has its own SQLite file at
 * `databases/tenants/{slug}.sqlite`. Connections are cached in memory and
 * evicted when the pool is full or when idle for too long.
 *
 * Prisma 7 requires a driver adapter, so each PrismaClient is built with
 * `@prisma/adapter-better-sqlite3` pointing at the tenant's file.
 *
 * Provisioning a new tenant database applies the tenant Prisma schema by
 * invoking `prisma db push` via `child_process` against
 * `prisma.tenant.config.ts`, with `TENANT_DATABASE_URL` set to the new
 * file. Run this once per new tenant during registration.
 *
 * @see Requirements 12.1, 12.2
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/tenant";

const PROJECT_ROOT = process.cwd();
const TENANT_DB_DIR = path.resolve(PROJECT_ROOT, "databases", "tenants");
const BACKUP_ROOT = path.resolve(PROJECT_ROOT, "backups");

export const MAX_POOL_SIZE = 20;
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PoolEntry {
  client: PrismaClient;
  lastUsed: number;
}

// Cache pool on globalThis so Next.js hot reload doesn't leak connections.
const globalForTenant = globalThis as unknown as {
  __tenantPool?: Map<string, PoolEntry>;
  __tenantIdleSweep?: NodeJS.Timeout;
};

const pool: Map<string, PoolEntry> =
  globalForTenant.__tenantPool ?? new Map<string, PoolEntry>();

if (!globalForTenant.__tenantPool) {
  globalForTenant.__tenantPool = pool;
}

/**
 * Periodic idle sweep — disconnects clients unused for longer than
 * IDLE_TIMEOUT_MS. One timer per process.
 */
function startIdleSweep(): void {
  if (globalForTenant.__tenantIdleSweep) return;
  const timer = setInterval(() => {
    const now = Date.now();
    const toEvict: string[] = [];
    pool.forEach((entry, slug) => {
      if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        toEvict.push(slug);
      }
    });
    for (const slug of toEvict) {
      const entry = pool.get(slug);
      pool.delete(slug);
      // Best-effort disconnect; ignore errors so the sweep doesn't crash.
      entry?.client.$disconnect().catch(() => {});
    }
  }, IDLE_TIMEOUT_MS);
  // Allow Node to exit even if the timer is still scheduled.
  if (typeof timer.unref === "function") timer.unref();
  globalForTenant.__tenantIdleSweep = timer;
}

startIdleSweep();

/** Compute the absolute SQLite path for a given tenant slug. */
export function tenantDbPath(tenantSlug: string): string {
  return path.resolve(TENANT_DB_DIR, `${tenantSlug}.sqlite`);
}

/** Build a Prisma `file:` URL pointing at a tenant's database file. */
function tenantDbUrl(tenantSlug: string): string {
  return `file:${tenantDbPath(tenantSlug)}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Evict the least-recently-used entry to make room for a new connection. */
function evictLru(): void {
  let oldestSlug: string | undefined;
  let oldestTime = Number.POSITIVE_INFINITY;
  pool.forEach((entry, slug) => {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestSlug = slug;
    }
  });
  if (oldestSlug !== undefined) {
    const evicted = pool.get(oldestSlug);
    pool.delete(oldestSlug);
    evicted?.client.$disconnect().catch(() => {});
  }
}

function createTenantClient(tenantSlug: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: tenantDbUrl(tenantSlug) });
  return new PrismaClient({ adapter });
}

/**
 * Get a PrismaClient for the given tenant slug. Returns a cached
 * connection if one exists, otherwise creates and caches a new one,
 * evicting the LRU entry if the pool is full.
 *
 * Note: this does not provision the database. The caller must ensure
 * the tenant database file already exists (via `provisionDatabase`).
 */
export async function getTenantDb(
  tenantSlug: string
): Promise<PrismaClient> {
  const cached = pool.get(tenantSlug);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  if (pool.size >= MAX_POOL_SIZE) {
    evictLru();
  }

  await ensureDir(TENANT_DB_DIR);
  const client = createTenantClient(tenantSlug);
  pool.set(tenantSlug, { client, lastUsed: Date.now() });
  return client;
}

/**
 * Provision a new SQLite database for a tenant.
 *
 * Steps:
 *   1. Ensure the tenant DB directory exists.
 *   2. Run `prisma db push` against `prisma.tenant.config.ts` with
 *      `TENANT_DATABASE_URL` pointing at the new file. This creates the
 *      file (if missing) and applies the tenant schema (all tables).
 *   3. Return the absolute path to the new database file.
 *
 * The tenant schema lacks a `url` directive, so the URL must be supplied
 * via env. We use `npx prisma db push` because Prisma 7 does not yet
 * provide a stable JS API for applying a schema programmatically.
 */
export async function provisionDatabase(
  tenantSlug: string
): Promise<string> {
  await ensureDir(TENANT_DB_DIR);
  const dbPath = tenantDbPath(tenantSlug);
  const dbUrl = `file:${dbPath}`;

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npxCmd,
    [
      "prisma",
      "db",
      "push",
      "--config=prisma.tenant.config.ts",
      "--skip-generate",
      "--accept-data-loss",
    ],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        TENANT_DATABASE_URL: dbUrl,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  if (result.status !== 0) {
    const stderr = result.stderr || result.stdout || "(no output)";
    throw new Error(
      `Failed to provision tenant database for "${tenantSlug}": ${stderr}`
    );
  }

  return dbPath;
}

/**
 * Disconnect and remove a tenant's connection from the pool.
 * Safe to call even if the tenant is not currently cached.
 */
export async function closeConnection(tenantSlug: string): Promise<void> {
  const entry = pool.get(tenantSlug);
  if (!entry) return;
  pool.delete(tenantSlug);
  await entry.client.$disconnect().catch(() => {});
}

/**
 * Archive the tenant's SQLite file by moving it to
 * `backups/{slug}/{timestamp}.sqlite`. Removes any cached connection
 * first so the file handle is released.
 */
export async function archiveDatabase(tenantSlug: string): Promise<void> {
  await closeConnection(tenantSlug);

  const sourcePath = tenantDbPath(tenantSlug);
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Cannot archive tenant "${tenantSlug}": database file not found at ${sourcePath}`
    );
  }

  const tenantBackupDir = path.resolve(BACKUP_ROOT, tenantSlug);
  await ensureDir(tenantBackupDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destPath = path.resolve(tenantBackupDir, `${timestamp}.sqlite`);

  await fs.rename(sourcePath, destPath);
}

/**
 * Restore the most recent backup for a tenant back to the active
 * tenant database location. Removes any cached connection so the new
 * file is picked up on next `getTenantDb`.
 */
export async function restoreDatabase(tenantSlug: string): Promise<void> {
  await closeConnection(tenantSlug);

  const tenantBackupDir = path.resolve(BACKUP_ROOT, tenantSlug);
  if (!existsSync(tenantBackupDir)) {
    throw new Error(
      `Cannot restore tenant "${tenantSlug}": no backup directory at ${tenantBackupDir}`
    );
  }

  const entries = await fs.readdir(tenantBackupDir);
  const sqliteFiles = entries.filter(
    (name) => name.endsWith(".sqlite") && !name.endsWith(".pre-restore.sqlite")
  );
  if (sqliteFiles.length === 0) {
    throw new Error(
      `Cannot restore tenant "${tenantSlug}": no .sqlite backups found`
    );
  }

  // Filenames use ISO timestamps with `:` and `.` replaced by `-`, so
  // lexicographic sort is chronological.
  sqliteFiles.sort();
  const latestBackup = sqliteFiles[sqliteFiles.length - 1];
  const sourcePath = path.resolve(tenantBackupDir, latestBackup);
  const destPath = tenantDbPath(tenantSlug);

  await ensureDir(path.dirname(destPath));

  // If a current file exists, move it aside before restore so we don't
  // silently overwrite live data.
  if (existsSync(destPath)) {
    const stash = path.resolve(
      tenantBackupDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}.pre-restore.sqlite`
    );
    await fs.rename(destPath, stash);
  }

  await fs.copyFile(sourcePath, destPath);
}

/**
 * Test helper / introspection — returns a snapshot of currently cached
 * tenant slugs. Not intended for production use.
 */
export function _getPoolSnapshot(): string[] {
  return Array.from(pool.keys());
}
