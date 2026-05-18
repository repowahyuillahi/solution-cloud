/**
 * Centralized API error definitions for the Web UI Absensi platform.
 *
 * Implements the error response format defined in
 * `.kiro/specs/web-ui-absensi/design.md` (Error Handling section). Every
 * route handler should return errors via {@link createErrorResponse} so
 * that clients receive a consistent JSON shape.
 */

import { NextResponse } from 'next/server';

// ============================================================================
// Error response shape
// ============================================================================

/**
 * Standard JSON body returned by every failing API endpoint.
 *
 * @example
 * {
 *   "error": {
 *     "code": "VALIDATION_EMPTY_FIELD",
 *     "message": "Field 'username' wajib diisi.",
 *     "field": "username"
 *   }
 * }
 */
export interface ApiError {
  error: {
    /** Machine-readable error code (see {@link ErrorCode}). */
    code: string;
    /** Human-readable message, in Indonesian where helpful. */
    message: string;
    /** Optional name of the field that caused the error. */
    field?: string;
  };
}

// ============================================================================
// Error code constants
// ============================================================================

/**
 * All known error codes, grouped by category. Codes are exported as
 * a `const` object so they can be referenced both as values and as a
 * discriminated string-literal type via {@link ErrorCode}.
 */
export const ErrorCode = {
  // --- Validation (400) ---
  VALIDATION_EMPTY_FIELD: 'VALIDATION_EMPTY_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // --- Authentication (401) ---
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_NOT_AUTHENTICATED: 'AUTH_NOT_AUTHENTICATED',

  // --- Authorization (403) ---
  RBAC_INSUFFICIENT_PERMISSION: 'RBAC_INSUFFICIENT_PERMISSION',
  RBAC_CROSS_TENANT_ACCESS: 'RBAC_CROSS_TENANT_ACCESS',

  // --- Tenant (404 not found / 403 suspended) ---
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',

  // --- Not Found (404) ---
  NOT_FOUND_USER: 'NOT_FOUND_USER',
  NOT_FOUND_MACHINE: 'NOT_FOUND_MACHINE',
  NOT_FOUND_EMPLOYEE: 'NOT_FOUND_EMPLOYEE',
  NOT_FOUND_TENANT: 'NOT_FOUND_TENANT',

  // --- Conflict (409) ---
  CONFLICT_DUPLICATE_USERNAME: 'CONFLICT_DUPLICATE_USERNAME',
  CONFLICT_DUPLICATE_SERIAL_NUMBER: 'CONFLICT_DUPLICATE_SERIAL_NUMBER',
  CONFLICT_DUPLICATE_KODE_KARYAWAN: 'CONFLICT_DUPLICATE_KODE_KARYAWAN',
  CONFLICT_DUPLICATE_SLUG: 'CONFLICT_DUPLICATE_SLUG',
  CONFLICT_DUPLICATE_EMAIL: 'CONFLICT_DUPLICATE_EMAIL',

  // --- License / Billing (402) ---
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  LICENSE_INVALID: 'LICENSE_INVALID',

  // --- Rate Limit (429) ---
  RATE_LIMIT_ACCOUNT_LOCKED: 'RATE_LIMIT_ACCOUNT_LOCKED',

  // --- Server (500) ---
  SERVER_INTERNAL_ERROR: 'SERVER_INTERNAL_ERROR',
  SERVER_DATABASE_ERROR: 'SERVER_DATABASE_ERROR',
} as const;

/** String-literal union of every supported error code. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Code → HTTP status mapping
// ============================================================================

/**
 * Maps an error code prefix to its default HTTP status.
 * Order matters: `TENANT_SUSPENDED` is mapped explicitly so it returns
 * 403 even though it shares the `TENANT_` prefix with `TENANT_NOT_FOUND`.
 */
const PREFIX_STATUS_MAP: ReadonlyArray<readonly [string, number]> = [
  ['VALIDATION_', 400],
  ['AUTH_', 401],
  ['LICENSE_', 402],
  ['RBAC_', 403],
  ['TENANT_NOT_FOUND', 404],
  ['TENANT_SUSPENDED', 403],
  ['TENANT_', 404],
  ['NOT_FOUND_', 404],
  ['CONFLICT_', 409],
  ['RATE_LIMIT_', 429],
  ['SERVER_', 500],
];

/**
 * Resolve the default HTTP status for an error code by matching its
 * prefix. Falls back to 500 for unknown codes.
 */
export function getStatusForCode(code: string): number {
  for (const [prefix, status] of PREFIX_STATUS_MAP) {
    if (code === prefix || code.startsWith(prefix)) {
      return status;
    }
  }
  return 500;
}

// ============================================================================
// Helper to build NextResponse error payloads
// ============================================================================

/**
 * Build a {@link NextResponse} carrying a standardized {@link ApiError}
 * body. The HTTP status is inferred from the code prefix unless an
 * explicit `status` override is provided.
 *
 * @param code    Machine-readable error code (see {@link ErrorCode}).
 * @param message Human-readable message (Indonesian preferred).
 * @param field   Optional offending field name.
 * @param status  Optional HTTP status override.
 */
export function createErrorResponse(
  code: string,
  message: string,
  field?: string,
  status?: number,
): NextResponse<ApiError> {
  const body: ApiError = {
    error: {
      code,
      message,
      ...(field !== undefined ? { field } : {}),
    },
  };

  return NextResponse.json<ApiError>(body, {
    status: status ?? getStatusForCode(code),
  });
}
