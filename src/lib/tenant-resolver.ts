/**
 * Tenant Resolver Service
 *
 * Resolves tenant information from a slug or custom domain by querying
 * the platform master database. Also provides slug validation and
 * reservation checks.
 *
 * @see Requirements 10.8, 12.2, 14.6, 13.3
 */

import type { Tenant } from '@/generated/master';
import type { TenantInfo, SubscriptionStatus } from '@/types';
import { prismaMaster } from '@/lib/db-master';

// ============================================================================
// Reserved Slugs
// ============================================================================

/**
 * Slugs reserved for platform routes and static assets.
 * These cannot be used as tenant slugs during registration.
 */
const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'portal',
  'api',
  'register',
  'login',
  'activate',
  '_next',
  'static',
]);

// ============================================================================
// Slug Validation
// ============================================================================

/** Pattern for valid tenant slugs: lowercase alphanumeric with hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Minimum slug length. */
const SLUG_MIN_LENGTH = 3;

/** Maximum slug length. */
const SLUG_MAX_LENGTH = 30;

/**
 * Check whether a slug is in the reserved list.
 *
 * @param slug - The slug to check.
 * @returns `true` if the slug is reserved and cannot be used by tenants.
 */
export function isSlugReserved(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Validate a tenant slug against format, length, and reservation rules.
 *
 * Rules:
 * - Must match `/^[a-z0-9]+(-[a-z0-9]+)*$/`
 * - Length must be between 3 and 30 characters (inclusive)
 * - Must not be a reserved slug
 *
 * @param slug - The slug to validate.
 * @returns `true` if the slug is valid for tenant use.
 */
export function validateSlug(slug: string): boolean {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return false;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return false;
  }
  if (isSlugReserved(slug)) {
    return false;
  }
  return true;
}

// ============================================================================
// Prisma Record → TenantInfo Mapping
// ============================================================================

/**
 * Map a raw Prisma Tenant record to the application-level TenantInfo
 * interface. Converts the `subscriptionStatus` string to the
 * `SubscriptionStatus` union type and maps date fields.
 */
function mapTenantToInfo(tenant: Tenant): TenantInfo {
  return {
    id: tenant.id,
    companyName: tenant.companyName,
    slug: tenant.slug,
    dbPath: tenant.dbPath,
    licenseCode: tenant.licenseCode,
    subscriptionStatus: tenant.subscriptionStatus as SubscriptionStatus,
    expiresAt: tenant.subscriptionExpiresAt,
    isActivated: tenant.isActivated,
    logoUrl: tenant.logoUrl,
    customDomain: tenant.customDomain,
  };
}

// ============================================================================
// Resolver Functions
// ============================================================================

/**
 * Resolve a tenant by its unique slug.
 *
 * @param slug - The tenant slug extracted from the URL path.
 * @returns The resolved `TenantInfo`, or `null` if no tenant matches.
 */
export async function resolveBySlug(slug: string): Promise<TenantInfo | null> {
  const tenant = await prismaMaster.tenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    return null;
  }

  return mapTenantToInfo(tenant);
}

/**
 * Resolve a tenant by its custom domain.
 *
 * @param domain - The custom domain to look up.
 * @returns The resolved `TenantInfo`, or `null` if no tenant matches.
 */
export async function resolveByCustomDomain(
  domain: string,
): Promise<TenantInfo | null> {
  const tenant = await prismaMaster.tenant.findUnique({
    where: { customDomain: domain },
  });

  if (!tenant) {
    return null;
  }

  return mapTenantToInfo(tenant);
}
