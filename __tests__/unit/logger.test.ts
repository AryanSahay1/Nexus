/**
 * Unit tests for src/utils/logger.ts.
 *
 * The logger is a LAW 2 enforcement point: nothing it emits may include a
 * raw token, an email, a phone number, a message body, or any other PII.
 * These tests fix the scrubbing semantics in place so that any future
 * regression (e.g. someone adding a new "convenient" field name to the
 * allowlist) is caught here before it ships.
 */

import { logEvent, logError, logInfo, logWarn, __internal } from '../../src/utils/logger';

const captureConsole = (): { logs: string[]; restore: () => void } => {
  const logs: string[] = [];
  // Info logs route through console.info (the GATE-4 cleanup ensures the
  // literal `console.log` no longer appears anywhere in src/). Spy on
  // every level the logger may use.
  const info = jest.spyOn(console, 'info').mockImplementation((m: unknown) => {
    logs.push(String(m));
  });
  const warn = jest.spyOn(console, 'warn').mockImplementation((m: unknown) => {
    logs.push(String(m));
  });
  const error = jest.spyOn(console, 'error').mockImplementation((m: unknown) => {
    logs.push(String(m));
  });
  return {
    logs,
    restore: () => {
      info.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    },
  };
};

describe('scrubString (PII patterns)', () => {
  const { scrubString } = __internal;

  it('redacts email addresses', () => {
    expect(scrubString('contact alice@example.com please')).toBe('contact [REDACTED] please');
  });

  it('redacts Bearer tokens', () => {
    expect(scrubString('Authorization: Bearer ya29.A0AfH6SMA-some-token')).toBe(
      'Authorization: [REDACTED]',
    );
  });

  it('redacts OpenAI sk- API keys', () => {
    expect(scrubString('key=sk-abcDEF123456789012')).toContain('[REDACTED]');
    expect(scrubString('key=sk-abcDEF123456789012')).not.toContain('sk-abcDEF');
  });

  it('redacts E.164 phone numbers', () => {
    expect(scrubString('call +91 98765 43210 now')).toContain('[REDACTED]');
    expect(scrubString('call +91 98765 43210 now')).not.toMatch(/98765/);
  });

  it('handles strings with no PII unchanged', () => {
    expect(scrubString('agent_turn_complete')).toBe('agent_turn_complete');
  });
});

describe('scrubFields (allowlist enforcement)', () => {
  const { scrubFields, SAFE_FIELDS } = __internal;

  it('allows fields on the allowlist', () => {
    const result = scrubFields({ tool_name: 'gmail_read_recent', latency_ms: 412, status: 'ok' });
    expect(result).toEqual({ tool_name: 'gmail_read_recent', latency_ms: 412, status: 'ok' });
  });

  it('redacts every field not on the allowlist, regardless of value', () => {
    const result = scrubFields({
      message_body: 'hello world',
      phone_number: '+919876543210',
      contact_name: 'Alice',
      user_email: 'a@b.com',
    });
    expect(result).toEqual({
      message_body: '[REDACTED]',
      phone_number: '[REDACTED]',
      contact_name: '[REDACTED]',
      user_email: '[REDACTED]',
    });
  });

  it('still scrubs PII inside allowlisted string values as a last-line defense', () => {
    const result = scrubFields({ status: 'sent to user@example.com' });
    expect(result).toEqual({ status: 'sent to [REDACTED]' });
  });

  it('coerces objects/arrays inside allowlisted fields to [REDACTED]', () => {
    const result = scrubFields({ status: { nested: 'value' } });
    expect(result).toEqual({ status: '[REDACTED]' });
  });

  it('preserves number, boolean, null, undefined for safe fields', () => {
    const result = scrubFields({
      latency_ms: 0,
      retry_count: 3,
      status: true,
      http_status: null,
      iteration: undefined,
    });
    expect(result.latency_ms).toBe(0);
    expect(result.retry_count).toBe(3);
    expect(result.status).toBe(true);
    expect(result.http_status).toBeNull();
    expect(result.iteration).toBeUndefined();
  });

  it('the allowlist is small and intentional', () => {
    expect(SAFE_FIELDS.size).toBeLessThanOrEqual(20);
    expect(SAFE_FIELDS.has('tool_name')).toBe(true);
    expect(SAFE_FIELDS.has('latency_ms')).toBe(true);
    expect(SAFE_FIELDS.has('phone_number')).toBe(false);
    expect(SAFE_FIELDS.has('user_email')).toBe(false);
    expect(SAFE_FIELDS.has('message')).toBe(false);
    expect(SAFE_FIELDS.has('content')).toBe(false);
    expect(SAFE_FIELDS.has('body')).toBe(false);
  });
});

describe('logEvent end-to-end emission', () => {
  it('writes a JSON-encoded structured payload to console at the requested level', () => {
    const cap = captureConsole();
    try {
      logInfo('agent_turn_complete', { tool_count: 2, total_latency_ms: 2100 });
      expect(cap.logs).toHaveLength(1);
      const entry = JSON.parse(cap.logs[0] ?? '');
      expect(entry).toMatchObject({
        level: 'info',
        event: 'agent_turn_complete',
        tool_count: 2,
        total_latency_ms: 2100,
      });
      expect(typeof entry.ts).toBe('number');
    } finally {
      cap.restore();
    }
  });

  it('routes warn and error to the matching console method', () => {
    const cap = captureConsole();
    try {
      logWarn('rate_limited', { http_status: 429 });
      logError('tool_error', { tool_name: 'gmail_send_email', error_code: 'NETWORK_ERROR' });
      expect(cap.logs).toHaveLength(2);
    } finally {
      cap.restore();
    }
  });

  it('redacts PII inside the event name itself', () => {
    const cap = captureConsole();
    try {
      logEvent('sent to user@example.com');
      const entry = JSON.parse(cap.logs[0] ?? '');
      expect(entry.event).toBe('sent to [REDACTED]');
    } finally {
      cap.restore();
    }
  });

  it('never lets a token-shaped value reach the console even via a non-allowlisted field', () => {
    const cap = captureConsole();
    try {
      logEvent('tool_success', {
        tool_name: 'gmail_send_email',
        secret: 'sk-super-secret-value-12345',
      });
      const joined = cap.logs.join('\n');
      expect(joined).not.toContain('sk-super-secret-value-12345');
      expect(joined).toContain('[REDACTED]');
    } finally {
      cap.restore();
    }
  });
});
