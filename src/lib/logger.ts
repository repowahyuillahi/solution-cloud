/**
 * Structured Logger
 *
 * Lightweight logger that outputs JSON in production and pretty-prints
 * in development. Supports context tagging (e.g., tenant, request ID).
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User logged in', { userId: 1, tenant: 'acme' });
 *   logger.error('DB connection failed', { error: err });
 *   const log = logger.child({ tenant: 'acme' });
 *   log.warn('Slow query', { durationMs: 1234 });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env === 'debug' || env === 'info' || env === 'warn' || env === 'error') {
    return env;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    };
  }
  return { value: String(err) };
}

function emit(entry: LogEntry): void {
  // In production, emit JSON for log aggregation tools.
  // In development, emit a human-readable line for the terminal.
  if (process.env.NODE_ENV === 'production') {
    const out = entry.level === 'error' || entry.level === 'warn' ? process.stderr : process.stdout;
    out.write(JSON.stringify(entry) + '\n');
    return;
  }

  const { level, message, timestamp: _ts, ...context } = entry;
  void _ts;
  const prefix = `[${level.toUpperCase()}]`;
  const contextStr = Object.keys(context).length > 0 ? ' ' + JSON.stringify(context) : '';
  if (level === 'error') {
    console.error(prefix, message, contextStr);
  } else if (level === 'warn') {
    console.warn(prefix, message, contextStr);
  } else if (level === 'debug') {
    console.debug(prefix, message, contextStr);
  } else {
    console.log(prefix, message, contextStr);
  }
}

class Logger {
  constructor(private readonly baseContext: Record<string, unknown> = {}) {}

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.baseContext,
      ...(context || {}),
    };

    // Auto-serialize error in entry.error
    if (entry.error !== undefined) {
      entry.error = serializeError(entry.error);
    }

    emit(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /** Create a child logger that inherits context. */
  child(extraContext: Record<string, unknown>): Logger {
    return new Logger({ ...this.baseContext, ...extraContext });
  }
}

export const logger = new Logger();
