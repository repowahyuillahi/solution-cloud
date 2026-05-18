/**
 * Authentication Module (Tenant-Aware)
 *
 * Uses iron-session v8 for encrypted cookie-based sessions. Sessions are
 * stateless — all data lives in the encrypted cookie. The module provides
 * helpers for reading/writing sessions as well as tenant-specific login
 * logic with account locking (5 failed attempts → 15 min lock).
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import type { SessionData } from "@/types";
import { getTenantDb } from "@/lib/db-tenant";

// ---------------------------------------------------------------------------
// Session Configuration
// ---------------------------------------------------------------------------

const SESSION_TTL = 1800; // 30 minutes in seconds

export const sessionOptions: SessionOptions = {
  cookieName: "wflab_session",
  password:
    process.env.SESSION_SECRET ??
    "complex_password_at_least_32_characters_long_for_dev_only!",
  ttl: SESSION_TTL,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

// ---------------------------------------------------------------------------
// Session Helpers
// ---------------------------------------------------------------------------

/**
 * Read the current session from request cookies.
 * Returns null if no valid session exists.
 */
export async function getSession(
  req: NextRequest
): Promise<SessionData | null> {
  const cookieStore = req.cookies;
  const sessionCookie = cookieStore.get(sessionOptions.cookieName);
  if (!sessionCookie?.value) return null;

  // Build a minimal CookieStore interface for iron-session
  const store = {
    get: (name: string) => {
      const c = cookieStore.get(name);
      return c ? { name: c.name, value: c.value } : undefined;
    },
    set: () => {
      // no-op for read-only access
    },
  };

  const session = await getIronSession<SessionData>(store, sessionOptions);

  // If the session has no loginAt, it's empty/invalid
  if (!session.loginAt) return null;

  return {
    portalTenantId: session.portalTenantId,
    portalEmail: session.portalEmail,
    tenantSlug: session.tenantSlug,
    userId: session.userId,
    username: session.username,
    role: session.role,
    isOwner: session.isOwner,
    loginAt: session.loginAt,
  };
}

/**
 * Create a session by setting the encrypted cookie on the response.
 * Returns the response with the Set-Cookie header applied.
 */
export async function createSession(
  res: NextResponse,
  data: SessionData
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  // Copy session data
  session.portalTenantId = data.portalTenantId;
  session.portalEmail = data.portalEmail;
  session.tenantSlug = data.tenantSlug;
  session.userId = data.userId;
  session.username = data.username;
  session.role = data.role;
  session.isOwner = data.isOwner;
  session.loginAt = data.loginAt;

  await session.save();

  return res;
}

/**
 * Destroy the session by clearing the session cookie.
 */
export function destroySession(res: NextResponse): NextResponse {
  res.cookies.set(sessionOptions.cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}

// ---------------------------------------------------------------------------
// Auth Helper Functions (Tenant DB)
// ---------------------------------------------------------------------------

/** Lock duration in milliseconds (15 minutes). */
const LOCK_DURATION_MS = 15 * 60 * 1000;

/** Maximum failed attempts before account is locked. */
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Authenticate a tenant user by username and password.
 *
 * - Resolves the tenant database via slug.
 * - Checks if the account is locked.
 * - Verifies the password with bcrypt.
 * - On success: resets failed attempts and returns SessionData.
 * - On failure: increments failed attempts (locks after 5).
 */
export async function loginTenantUser(
  tenantSlug: string,
  username: string,
  password: string
): Promise<SessionData | null> {
  const db = await getTenantDb(tenantSlug);

  const user = await db.user.findUnique({ where: { username } });
  if (!user) return null;

  // Check if account is locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return null;
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await incrementFailedAttempts(tenantSlug, username);
    return null;
  }

  // Success — reset failed attempts
  await resetFailedAttempts(tenantSlug, username);

  return {
    tenantSlug,
    userId: user.id,
    username: user.username,
    role: user.role as SessionData["role"],
    loginAt: Date.now(),
  };
}

/**
 * Increment the failed login attempts counter for a user.
 * If the counter reaches MAX_FAILED_ATTEMPTS, lock the account for 15 minutes.
 * Returns the new failed attempts count.
 */
export async function incrementFailedAttempts(
  tenantSlug: string,
  username: string
): Promise<number> {
  const db = await getTenantDb(tenantSlug);

  const user = await db.user.findUnique({ where: { username } });
  if (!user) return 0;

  const newCount = user.failedAttempts + 1;

  const updateData: { failedAttempts: number; lockedUntil?: Date | null } = {
    failedAttempts: newCount,
  };

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
  }

  await db.user.update({
    where: { username },
    data: updateData,
  });

  return newCount;
}

/**
 * Check whether a user's account is currently locked.
 */
export async function isAccountLocked(
  tenantSlug: string,
  username: string
): Promise<boolean> {
  const db = await getTenantDb(tenantSlug);

  const user = await db.user.findUnique({ where: { username } });
  if (!user) return false;

  if (!user.lockedUntil) return false;

  return new Date(user.lockedUntil) > new Date();
}

/**
 * Reset the failed login attempts counter and clear any lock.
 */
export async function resetFailedAttempts(
  tenantSlug: string,
  username: string
): Promise<void> {
  const db = await getTenantDb(tenantSlug);

  await db.user.update({
    where: { username },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}
