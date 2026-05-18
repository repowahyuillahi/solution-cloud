/**
 * Master Database Connection
 *
 * Singleton PrismaClient for the platform master database (master.sqlite).
 * Uses globalThis pattern to prevent multiple instances during Next.js
 * hot reload in development.
 *
 * Prisma 7 requires a driver adapter rather than the legacy `datasources`
 * override. We use `@prisma/adapter-better-sqlite3`, passing the file
 * URL at construction time. The default location is
 * `./databases/master.sqlite` relative to the project root, overridable
 * via the `MASTER_DATABASE_URL` env var (e.g. `file:./alt/master.sqlite`).
 *
 * @see Requirements 12.1, 12.2
 */

import path from "node:path";
import fs from "node:fs";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/master";

const PROJECT_ROOT = process.cwd();
const DEFAULT_MASTER_DB_PATH = path.resolve(
  PROJECT_ROOT,
  "databases",
  "master.sqlite"
);

/**
 * Resolve the master database connection URL. Accepts the same `file:`
 * URL syntax Prisma uses elsewhere — this keeps env var configuration
 * consistent with the schema/config files.
 */
function resolveMasterDatabaseUrl(): string {
  const fromEnv = process.env.MASTER_DATABASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  return `file:${DEFAULT_MASTER_DB_PATH}`;
}

/** Ensure the parent directory of the master DB exists before connecting. */
function ensureMasterDir(url: string): void {
  // Strip a leading `file:` prefix if present.
  const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(PROJECT_ROOT, filePath);
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createMasterClient(): PrismaClient {
  const url = resolveMasterDatabaseUrl();
  ensureMasterDir(url);
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

// Cache the client on globalThis to survive Next.js hot reload in dev.
const globalForMaster = globalThis as unknown as {
  __prismaMaster?: PrismaClient;
};

export const prismaMaster: PrismaClient =
  globalForMaster.__prismaMaster ?? createMasterClient();

if (process.env.NODE_ENV !== "production") {
  globalForMaster.__prismaMaster = prismaMaster;
}

/**
 * Helper accessor — returns the singleton master PrismaClient.
 * Prefer this in services/route handlers for clarity.
 */
export function getMasterDb(): PrismaClient {
  return prismaMaster;
}
