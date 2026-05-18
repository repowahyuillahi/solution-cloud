/**
 * Registration Service
 *
 * Handles new tenant registration, license code generation, and
 * dashboard activation. Creates the tenant record in the master DB,
 * provisions a new SQLite database, and seeds the default Superadmin
 * user in the tenant DB.
 *
 * @see Requirements 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import { prismaMaster } from '@/lib/db-master';
import { provisionDatabase, getTenantDb } from '@/lib/db-tenant';
import { validateSlug, isSlugReserved } from '@/lib/tenant-resolver';
import type { RegistrationInput, RegistrationResult } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** Number of bcrypt hashing rounds for admin passwords. */
const BCRYPT_ROUNDS = 10;

/** Trial duration in days. */
const TRIAL_DURATION_DAYS = 14;

// ============================================================================
// License Code Generation
// ============================================================================

/**
 * Generate a unique license code using cryptographically secure random bytes.
 *
 * @returns A 32-character hex string (16 random bytes).
 */
export function generateLicenseCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register a new tenant on the platform.
 *
 * Steps:
 *   1. Validate slug format and ensure it's not reserved.
 *   2. Check slug uniqueness in master DB.
 *   3. Check email uniqueness in master DB.
 *   4. Hash admin password with bcrypt.
 *   5. Generate a unique license code.
 *   6. Calculate trial expiry (14 days from now).
 *   7. Create tenant record in master DB.
 *   8. Provision tenant SQLite database.
 *   9. Create default Superadmin user in tenant DB.
 *  10. Return registration result.
 *
 * @throws Error with specific message for validation/conflict issues.
 */
export async function register(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const { companyName, companySlug, adminEmail, adminUsername, adminPassword } =
    input;

  // 1. Validate slug format + not reserved
  if (!validateSlug(companySlug)) {
    if (isSlugReserved(companySlug)) {
      throw new RegistrationError('SLUG_RESERVED', 'Slug ini sudah direservasi oleh platform.');
    }
    throw new RegistrationError('SLUG_INVALID', 'Format slug tidak valid. Gunakan huruf kecil, angka, dan tanda hubung (3-30 karakter).');
  }

  // 2. Check slug uniqueness
  const existingSlug = await prismaMaster.tenant.findUnique({
    where: { slug: companySlug },
  });
  if (existingSlug) {
    throw new RegistrationError('SLUG_DUPLICATE', 'Slug sudah digunakan oleh tenant lain.');
  }

  // 3. Check email uniqueness
  const existingEmail = await prismaMaster.tenant.findUnique({
    where: { adminEmail },
  });
  if (existingEmail) {
    throw new RegistrationError('EMAIL_DUPLICATE', 'Email sudah terdaftar.');
  }

  // 4. Hash admin password
  const adminPasswordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  // 5. Generate license code
  const licenseCode = generateLicenseCode();

  // 6. Calculate trial expiry
  const now = new Date();
  const trialExpiresAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // 7. Create tenant record in master DB
  const dbPath = `databases/tenants/${companySlug}.sqlite`;

  const tenant = await prismaMaster.tenant.create({
    data: {
      companyName,
      slug: companySlug,
      adminEmail,
      adminPasswordHash,
      licenseCode,
      subscriptionStatus: 'trial',
      trialStartedAt: now,
      subscriptionExpiresAt: trialExpiresAt,
      dbPath,
      isActivated: false,
    },
  });

  // 8. Provision tenant database
  await provisionDatabase(companySlug);

  // 9. Create default Superadmin user in tenant DB
  const tenantDb = await getTenantDb(companySlug);
  await tenantDb.user.create({
    data: {
      username: adminUsername,
      passwordHash: adminPasswordHash,
      role: 'Superadmin',
    },
  });

  // 10. Return result
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    licenseCode,
    trialExpiresAt,
  };
}

// ============================================================================
// Dashboard Activation
// ============================================================================

/**
 * Activate a tenant's dashboard by verifying the license code.
 *
 * @param slug - The tenant slug.
 * @param licenseCode - The license code to verify.
 * @returns `true` if activation succeeded, `false` otherwise.
 */
export async function activateDashboard(
  slug: string,
  licenseCode: string,
): Promise<boolean> {
  const tenant = await prismaMaster.tenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    return false;
  }

  if (tenant.licenseCode !== licenseCode) {
    return false;
  }

  await prismaMaster.tenant.update({
    where: { id: tenant.id },
    data: { isActivated: true },
  });

  return true;
}

// ============================================================================
// Custom Error Class
// ============================================================================

export type RegistrationErrorCode =
  | 'SLUG_RESERVED'
  | 'SLUG_INVALID'
  | 'SLUG_DUPLICATE'
  | 'EMAIL_DUPLICATE';

/**
 * Typed error thrown by the registration service for known failure modes.
 */
export class RegistrationError extends Error {
  public readonly code: RegistrationErrorCode;

  constructor(code: RegistrationErrorCode, message: string) {
    super(message);
    this.name = 'RegistrationError';
    this.code = code;
  }
}
