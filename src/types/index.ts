/**
 * Shared TypeScript types for the Web UI Absensi platform.
 *
 * Mirrors the interfaces defined in `.kiro/specs/web-ui-absensi/design.md`
 * (Components and Interfaces section). These types are framework-agnostic
 * and can be used by both server (route handlers, services) and client
 * (React components) code.
 */

// ============================================================================
// Tenant & Subscription
// ============================================================================

/** Lifecycle status of a tenant's subscription. */
export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'
  | 'archived';

/** Information about a tenant resolved from a slug or custom domain. */
export interface TenantInfo {
  id: number;
  companyName: string;
  slug: string;
  /** Path to the tenant's SQLite file. */
  dbPath: string;
  licenseCode: string;
  subscriptionStatus: SubscriptionStatus;
  expiresAt: Date;
  isActivated: boolean;
  logoUrl: string | null;
  customDomain: string | null;
}

/** Subscription plan offered by the platform. */
export interface SubscriptionPlan {
  type: 'monthly' | 'yearly';
  /** Price in Indonesian Rupiah (e.g. 35000 for monthly). */
  priceIdr: number;
  /** Duration of the plan in days (30 or 365). */
  durationDays: number;
}

// ============================================================================
// RBAC
// ============================================================================

/** Tenant-level user role. */
export type TenantRole = 'Superadmin' | 'HRD' | 'Resepsionis';

/** Application feature gated by RBAC. */
export type Feature =
  | 'user-management'
  | 'machine-management'
  | 'employee-management'
  | 'bulk-download'
  | 'report'
  | 'dashboard'
  | 'branch-schedule'
  | 'company-profile'
  | 'domain-settings';

// ============================================================================
// Auth / Session
// ============================================================================

/**
 * Encrypted session payload stored in iron-session cookies.
 * The session may carry portal, tenant, or platform-owner context
 * depending on which login flow was used.
 */
export interface SessionData {
  // Portal session (customer portal)
  portalTenantId?: number;
  portalEmail?: string;

  // Tenant app session
  tenantSlug?: string;
  userId?: number;
  username?: string;
  role?: TenantRole;

  // Platform owner session
  isOwner?: boolean;

  /** Unix timestamp (ms) when the session was created. */
  loginAt: number;
}

// ============================================================================
// Bulk Download
// ============================================================================

/** Per-machine progress event emitted during a bulk download. */
export interface DownloadProgress {
  machineId: number;
  kodeDealer: string;
  namaDealer: string;
  status: 'processing' | 'success' | 'failed';
  error?: string;
  logsCount?: number;
}

/** Aggregate result returned when a bulk download completes. */
export interface BulkDownloadResult {
  totalMachines: number;
  successCount: number;
  failedCount: number;
  totalLogs: number;
  startedAt: Date;
  completedAt: Date;
}

// ============================================================================
// Reports & Attendance Logs
// ============================================================================

/** A single row in the generated attendance report. */
export interface AttendanceRecord {
  kodeDealer: string;
  namaDealer: string;
  /** Date in YYYY-MM-DD format. */
  tanggal: string;
  kodeKaryawan: string;
  namaKaryawan: string;
  /** Earliest tap time (HH:MM:SS) or null if no taps. */
  jamMasuk: string | null;
  /** Latest tap time (HH:MM:SS) or null if there is only one or zero taps. */
  jamPulang: string | null;
  totalTap: number;
  status: 'Tepat Waktu' | 'Telat' | 'Tidak Masuk';
}

/** Filter applied when generating an attendance report. */
export interface ReportFilter {
  /** Inclusive start date in YYYY-MM-DD format. */
  startDate: string;
  /** Inclusive end date in YYYY-MM-DD format. */
  endDate: string;
  /** Optional branch filter. */
  kodeDealer?: string;
}

/** A single line parsed from an `att_log.dat` file. */
export interface AttLogEntry {
  /** Employee fingerprint code. */
  id: string;
  /** Tap timestamp. */
  datetime: Date;
  status1: number;
  status2: number;
  status3: number;
}

// ============================================================================
// Employee Import
// ============================================================================

/** Summary returned after a bulk Excel import of employees. */
export interface ImportResult {
  totalRows: number;
  successCount: number;
  /** Rows skipped because the kodeKaryawan already exists. */
  skippedCount: number;
  /** Rows that failed validation. */
  failedCount: number;
  errors: Array<{ row: number; reason: string }>;
}

// ============================================================================
// Platform Owner Admin
// ============================================================================

/** Compact tenant view shown in the platform admin tenant list. */
export interface TenantSummary {
  id: number;
  companyName: string;
  slug: string;
  registrationDate: Date;
  subscriptionStatus: SubscriptionStatus;
  lastActivityDate: Date;
  machineCount: number;
  employeeCount: number;
  userCount: number;
}

/** Aggregate platform-wide statistics for the owner dashboard. */
export interface PlatformStats {
  totalTenants: number;
  activeSubscriptions: number;
  trialsExpiringSoon: number;
  totalPlatformUsage: {
    totalMachines: number;
    totalEmployees: number;
    totalDownloads: number;
  };
}

// ============================================================================
// Registration
// ============================================================================

/** Input collected from the public tenant registration form. */
export interface RegistrationInput {
  companyName: string;
  /** lowercase letters, digits, hyphens, 3-30 chars. */
  companySlug: string;
  adminEmail: string;
  /** 3-30 alphanumeric characters. */
  adminUsername: string;
  /** 8-128 characters. */
  adminPassword: string;
}

/** Result returned after a successful registration. */
export interface RegistrationResult {
  tenantId: number;
  slug: string;
  licenseCode: string;
  trialExpiresAt: Date;
}
