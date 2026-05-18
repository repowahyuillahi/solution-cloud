/**
 * RBAC (Role-Based Access Control) module.
 *
 * Defines role-permission mappings and provides pure helper functions
 * for checking access in route handlers and UI components.
 */

import type { TenantRole, Feature, SessionData } from '@/types';

// ============================================================================
// Role → Feature permission map
// ============================================================================

export const ROLE_PERMISSIONS: Record<TenantRole, Feature[]> = {
  Superadmin: [
    'user-management',
    'machine-management',
    'employee-management',
    'bulk-download',
    'report',
    'dashboard',
    'branch-schedule',
    'company-profile',
    'domain-settings',
  ],
  HRD: ['employee-management', 'bulk-download', 'report', 'dashboard'],
  Resepsionis: ['report', 'dashboard'],
};

// ============================================================================
// Permission check helpers
// ============================================================================

/**
 * Returns true if the given role has access to the specified feature.
 */
export function hasPermission(role: TenantRole, feature: Feature): boolean {
  return ROLE_PERMISSIONS[role].includes(feature);
}

/**
 * Returns a checker function that validates the session has one of the allowed roles.
 */
export function requireRole(
  allowedRoles: TenantRole[],
): (session: SessionData | null) => { allowed: boolean; error?: string } {
  return (session: SessionData | null) => {
    if (!session || !session.role || !allowedRoles.includes(session.role)) {
      return { allowed: false, error: 'Insufficient permissions' };
    }
    return { allowed: true };
  };
}

/**
 * Returns a checker function that validates the session belongs to the platform owner.
 */
export function requireOwner(): (session: SessionData | null) => { allowed: boolean; error?: string } {
  return (session: SessionData | null) => {
    if (!session || session.isOwner !== true) {
      return { allowed: false, error: 'Insufficient permissions' };
    }
    return { allowed: true };
  };
}

/**
 * Returns a checker function that validates the session has portal authentication.
 */
export function requirePortalAuth(): (session: SessionData | null) => { allowed: boolean; error?: string } {
  return (session: SessionData | null) => {
    if (!session || session.portalTenantId === undefined) {
      return { allowed: false, error: 'Insufficient permissions' };
    }
    return { allowed: true };
  };
}

/**
 * Returns the list of features accessible to the given role.
 */
export function getAccessibleFeatures(role: TenantRole): Feature[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Alias for hasPermission — intended for clarity in UI components.
 */
export function isFeatureAccessible(role: TenantRole, feature: Feature): boolean {
  return hasPermission(role, feature);
}
