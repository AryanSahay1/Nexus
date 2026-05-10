/**
 * Privacy-safe structured logger.
 *
 * Project Nexus is local-first. The logger MUST never emit tokens, message
 * bodies, phone numbers, names, locations, or other PII. This module enforces
 * a small allowlist of acceptable fields and aggressively scrubs anything else.
 *
 * Usage:
 *   logEvent('tool_success', { tool_name: 'gmail_read_recent', latency_ms: 412 });
 *
 * The logger is intentionally console-only by default. Remote telemetry, if
 * ever added, must layer on top and inherit the same scrubbing rules.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Allowlisted field names. Any field not in this set is replaced with
 * `'[REDACTED]'` before emission, even if its value looks innocuous.
 */
const SAFE_FIELDS: ReadonlySet<string> = new Set([
  'tool_name',
  'tool_count',
  'latency_ms',
  'total_latency_ms',
  'error_type',
  'error_code',
  'provider',
  'status',
  'finish_reason',
  'iteration',
  'app_env',
  'screen',
  'event',
  'duration_ms',
  'http_status',
  'retry_count',
  'queue_size',
  'connected_providers_count',
]);

/**
 * Conservative regex patterns that match obvious PII (emails, bearer tokens,
 * sk- API keys, E.164 phone numbers). Only used as a last-line defense before
 * anything is written to console.
 */
const PII_PATTERNS: readonly RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /Bearer\s+[A-Za-z0-9._\-~+/=]+/gi,
  /\bsk-[A-Za-z0-9_\-]{16,}\b/g,
  /\+?\d[\d\s\-().]{7,}\d/g,
];

const scrubString = (value: string): string => {
  let out = value;
  for (const pattern of PII_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
};

const scrubValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return '[REDACTED]';
};

const scrubFields = (fields: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SAFE_FIELDS.has(key)) {
      safe[key] = scrubValue(value);
    } else {
      safe[key] = '[REDACTED]';
    }
  }
  return safe;
};

const emit = (level: LogLevel, event: string, fields: Record<string, unknown>): void => {
  const payload = { level, event, ts: Date.now(), ...fields };
  // eslint-disable-next-line no-console
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(JSON.stringify(payload));
};

/** Emit a structured log event. Field names not in the safe-field allowlist are redacted. */
export const logEvent = (
  event: string,
  fields: Readonly<Record<string, unknown>> = {},
  level: LogLevel = 'info',
): void => {
  const safe = scrubFields(fields);
  emit(level, scrubString(event), safe);
};

/** Convenience wrappers. */
export const logInfo = (event: string, fields?: Readonly<Record<string, unknown>>): void =>
  logEvent(event, fields, 'info');
export const logWarn = (event: string, fields?: Readonly<Record<string, unknown>>): void =>
  logEvent(event, fields, 'warn');
export const logError = (event: string, fields?: Readonly<Record<string, unknown>>): void =>
  logEvent(event, fields, 'error');

/** Exposed for unit tests only; not part of the public API surface. */
export const __internal = { scrubString, scrubFields, SAFE_FIELDS };
