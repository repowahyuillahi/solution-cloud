/**
 * Environment variable validation.
 *
 * Validates critical configuration at startup. Fails loudly when running
 * in production with insecure defaults.
 */

const DEFAULT_SESSION_SECRET =
  'complex_password_at_least_32_characters_long_for_dev_only!';

const DEFAULT_OWNER_PASSWORDS = new Set([
  'admin123456',
  'admin123',
  'password',
  'admin',
]);

interface ValidationIssue {
  level: 'error' | 'warning';
  variable: string;
  message: string;
}

export interface EnvValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate the runtime environment. In production mode, default secrets
 * are treated as fatal errors. In development they are warnings.
 */
export function validateEnvironment(): EnvValidationResult {
  const issues: ValidationIssue[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  // SESSION_SECRET
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    issues.push({
      level: isProd ? 'error' : 'warning',
      variable: 'SESSION_SECRET',
      message: 'SESSION_SECRET is not set — using insecure dev default.',
    });
  } else if (secret === DEFAULT_SESSION_SECRET) {
    issues.push({
      level: isProd ? 'error' : 'warning',
      variable: 'SESSION_SECRET',
      message: 'SESSION_SECRET still uses the default placeholder value.',
    });
  } else if (secret.length < 32) {
    issues.push({
      level: isProd ? 'error' : 'warning',
      variable: 'SESSION_SECRET',
      message: 'SESSION_SECRET should be at least 32 characters.',
    });
  }

  // OWNER_PASSWORD
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (ownerPassword && DEFAULT_OWNER_PASSWORDS.has(ownerPassword)) {
    issues.push({
      level: isProd ? 'error' : 'warning',
      variable: 'OWNER_PASSWORD',
      message: 'OWNER_PASSWORD is a known weak default — change it.',
    });
  }
  if (isProd && !ownerPassword) {
    issues.push({
      level: 'warning',
      variable: 'OWNER_PASSWORD',
      message: 'OWNER_PASSWORD is not set — first-time seed will use unsafe default.',
    });
  }

  const errors = issues.filter((i) => i.level === 'error');
  return { valid: errors.length === 0, issues };
}

/**
 * Run validation and fail fast if production runs with insecure defaults.
 * Logs warnings in non-production.
 */
export function assertEnvironmentSecure(): void {
  const result = validateEnvironment();
  if (result.issues.length === 0) return;

  const isProd = process.env.NODE_ENV === 'production';

  for (const issue of result.issues) {
    const prefix = issue.level === 'error' ? '[FATAL]' : '[WARN]';
    // Use raw console here; logger may not have its env yet at boot.
    console.error(`${prefix} ${issue.variable}: ${issue.message}`);
  }

  if (isProd && !result.valid) {
    console.error(
      '[FATAL] Refusing to start in production with insecure environment. ' +
        'Set proper values for the variables above and restart.'
    );
    process.exit(1);
  }
}
