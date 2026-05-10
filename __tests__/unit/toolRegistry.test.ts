/**
 * Unit tests for src/agent/toolRegistry.ts.
 *
 * Covers: register / get / listAll, plus validateInput across every
 * supported JSON-Schema branch (required, types, ranges, enum, regex,
 * arrays, nested objects).
 */

import {
  __resetForTests,
  get,
  listAll,
  register,
  validateInput,
} from '../../src/agent/toolRegistry';
import type { NexusTool } from '../../src/types/agent';
import { NexusError, type Result, ok } from '../../src/types/auth';

const sampleTool: NexusTool<{ readonly echoed: string }> = {
  name: 'sample',
  description: 'Echoes input.text back as `echoed`.',
  isDestructive: false,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', minLength: 1, maxLength: 200 },
      count: { type: 'integer', minimum: 0, maximum: 10 },
      flag: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string', pattern: '^[a-z]+$' } },
      mode: { type: 'string', enum: ['fast', 'slow'] },
      meta: {
        type: 'object',
        properties: { ratio: { type: 'number', minimum: 0, maximum: 1 } },
        required: ['ratio'],
      },
    },
    required: ['text'],
  },
  execute: async (input): Promise<Result<{ readonly echoed: string }, NexusError>> =>
    ok({ echoed: String(input.text) }),
};

beforeEach(() => {
  __resetForTests();
});

describe('register / get / listAll', () => {
  it('register stores a tool that get() can retrieve', () => {
    register(sampleTool);
    expect(get('sample')?.name).toBe('sample');
  });

  it('get returns null for unknown names', () => {
    expect(get('nope')).toBeNull();
  });

  it('register replaces an existing tool with the same name', () => {
    register(sampleTool);
    const replacement: NexusTool<{ readonly echoed: string }> = {
      ...sampleTool,
      description: 'replaced',
    };
    register(replacement);
    expect(get('sample')?.description).toBe('replaced');
  });

  it('listAll returns descriptors without execute()', () => {
    register(sampleTool);
    const descriptors = listAll();
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]?.name).toBe('sample');
    expect(descriptors[0]?.isDestructive).toBe(false);
    expect((descriptors[0] as unknown as Record<string, unknown>).execute).toBeUndefined();
  });
});

// ── validateInput ───────────────────────────────────────────────────────

describe('validateInput — happy paths', () => {
  beforeEach(() => register(sampleTool));

  it('accepts a minimal object containing only required fields', () => {
    const result = validateInput('sample', { text: 'hi' });
    expect(result.ok).toBe(true);
  });

  it('accepts every supported field correctly typed', () => {
    const result = validateInput('sample', {
      text: 'hello',
      count: 3,
      flag: true,
      tags: ['alpha', 'beta'],
      mode: 'fast',
      meta: { ratio: 0.5 },
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateInput — failure paths', () => {
  beforeEach(() => register(sampleTool));

  it('rejects when the named tool does not exist', () => {
    const result = validateInput('does-not-exist', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects non-object inputs', () => {
    const result = validateInput('sample', 'just a string');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects when a required field is missing', () => {
    const result = validateInput('sample', { count: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('text');
    }
  });

  it('rejects type mismatches', () => {
    const result = validateInput('sample', { text: 'ok', count: 'not-a-number' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects out-of-range numbers', () => {
    const result = validateInput('sample', { text: 'ok', count: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('≤ 10');
  });

  it('rejects strings outside the enum', () => {
    const result = validateInput('sample', { text: 'ok', mode: 'sideways' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('one of');
  });

  it('rejects array items that fail the per-item schema', () => {
    const result = validateInput('sample', { text: 'ok', tags: ['Bad-Caps'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('descends into nested objects', () => {
    const result = validateInput('sample', { text: 'ok', meta: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('ratio');
  });

  it('rejects strings violating the configured pattern', () => {
    register({
      ...sampleTool,
      name: 'patterned',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', pattern: '^[^@]+@[^@]+$' },
        },
        required: ['email'],
      },
    });
    const result = validateInput('patterned', { email: 'no-at-sign' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('pattern');
  });

  it('rejects non-integer numbers when type is integer', () => {
    const result = validateInput('sample', { text: 'ok', count: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('integer');
  });
});
