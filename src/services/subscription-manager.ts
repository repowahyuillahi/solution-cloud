/**
 * Subscription Manager Service
 *
 * Handles tenant subscription lifecycle: trial creation, status checks,
 * plan extensions, expiry warnings, archival, and license code management.
 *
 * All operations use the platform master database (prismaMaster).
 *
 * @see Design: Subscription Manager Service interface
 * @see Requirements: Subscription Lifecycle
 */

import crypto from "node:crypto";

import { prismaMaster } from "@/lib/db-master";
import { archiveDatabase, restoreDatabase } from "@/lib/db-tenant";
import type { SubscriptionStatus, SubscriptionPlan } from "@/types";

/**
 * Create a free trial subscription for a newly registered tenant.
 * Sets status to 'trial' with a 14-day expiry from now.
 */
export async function createTrial(tenantId: number): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await prismaMaster.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionStatus: "trial",
      subscriptionExpiresAt: expiresAt,
    },
  });
}

/**
 * Check and update the subscription status for a tenant.
 *
 * If the tenant is in 'trial' or 'active' state:
 *   - If expiresAt < now → mark as 'expired'
 *   - If expiresAt < now + 7 days → mark as 'expiring_soon'
 *   - Otherwise return current status unchanged
 *
 * For other states ('expired', 'suspended', 'archived', 'expiring_soon'),
 * returns the current status as-is.
 */
export async function checkStatus(
  tenantId: number
): Promise<SubscriptionStatus> {
  const tenant = await prismaMaster.tenant.findUniqueOrThrow({
    where: { id: tenantId },
  });

  const currentStatus = tenant.subscriptionStatus as SubscriptionStatus;

  if (currentStatus === "trial" || currentStatus === "active") {
    const now = new Date();
    const expiresAt = new Date(tenant.subscriptionExpiresAt);

    if (expiresAt < now) {
      await prismaMaster.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: "expired" },
      });
      return "expired";
    }

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    if (expiresAt < sevenDaysFromNow) {
      await prismaMaster.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: "expiring_soon" },
      });
      return "expiring_soon";
    }

    return currentStatus;
  }

  return currentStatus;
}

/**
 * Extend a tenant's subscription after payment.
 * Sets status to 'active', calculates new expiry date, and records payment.
 */
export async function extendSubscription(
  tenantId: number,
  plan: SubscriptionPlan
): Promise<void> {
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + plan.durationDays);

  await prismaMaster.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionStatus: "active",
      subscriptionExpiresAt: newExpiry,
    },
  });

  await prismaMaster.paymentHistory.create({
    data: {
      tenantId,
      planType: plan.type,
      amountIdr: plan.priceIdr,
      validUntil: newExpiry,
    },
  });
}

/**
 * Get the number of days remaining on a tenant's subscription.
 * Returns 0 if the subscription has already expired.
 */
export async function getDaysRemaining(tenantId: number): Promise<number> {
  const tenant = await prismaMaster.tenant.findUniqueOrThrow({
    where: { id: tenantId },
  });

  const now = new Date();
  const expiresAt = new Date(tenant.subscriptionExpiresAt);
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Determine whether a subscription warning should be shown.
 * Returns true if fewer than 7 days remain and the tenant is in
 * 'trial', 'active', or 'expiring_soon' status.
 */
export async function shouldShowWarning(
  tenantId: number
): Promise<boolean> {
  const tenant = await prismaMaster.tenant.findUniqueOrThrow({
    where: { id: tenantId },
  });

  const status = tenant.subscriptionStatus as SubscriptionStatus;
  if (
    status !== "trial" &&
    status !== "active" &&
    status !== "expiring_soon"
  ) {
    return false;
  }

  const daysRemaining = await getDaysRemaining(tenantId);
  return daysRemaining < 7;
}

/**
 * Archive an expired tenant's database.
 * Moves the SQLite file to the backup directory and marks the tenant
 * as 'archived'.
 */
export async function archiveExpiredTenant(
  tenantId: number
): Promise<void> {
  const tenant = await prismaMaster.tenant.findUniqueOrThrow({
    where: { id: tenantId },
  });

  await archiveDatabase(tenant.slug);

  await prismaMaster.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: "archived" },
  });
}

/**
 * Restore an archived tenant's database and reactivate their subscription.
 * Restores the most recent backup, sets status to 'active' with a 30-day
 * subscription, and assigns the new license code.
 */
export async function restoreTenant(
  tenantId: number,
  newLicenseCode: string
): Promise<void> {
  const tenant = await prismaMaster.tenant.findUniqueOrThrow({
    where: { id: tenantId },
  });

  await restoreDatabase(tenant.slug);

  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 30);

  await prismaMaster.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionStatus: "active",
      licenseCode: newLicenseCode,
      subscriptionExpiresAt: newExpiry,
    },
  });
}

/**
 * Generate a unique license code (32-character hex string).
 */
export function generateLicenseCode(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Regenerate the license code for a tenant and persist it.
 * Returns the new license code.
 */
export async function regenerateLicenseCode(
  tenantId: number
): Promise<string> {
  const newCode = generateLicenseCode();

  await prismaMaster.tenant.update({
    where: { id: tenantId },
    data: { licenseCode: newCode },
  });

  return newCode;
}
