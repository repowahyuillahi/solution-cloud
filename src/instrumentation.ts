/**
 * Next.js Instrumentation Hook
 *
 * Runs once at server startup. Used to validate environment configuration.
 *
 * Note: graceful shutdown handlers are registered when DB modules are first
 * imported in route handlers (see lib/db-master.ts). We avoid registering
 * them here because Next.js's instrumentation webpack chunk does not
 * support importing modules with native dependencies.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { assertEnvironmentSecure } = await import('@/lib/env-validate');
  assertEnvironmentSecure();
}
