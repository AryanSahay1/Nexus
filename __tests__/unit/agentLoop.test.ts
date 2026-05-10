/**
 * Unit tests for src/agent/agentLoop.ts.
 *
 * Strategy:
 *  - SecureStore mock returns a fake OpenAI API key.
 *  - apiClient adapter returns scripted OpenAI completions in sequence.
 *  - The toolRegistry is wiped each test; tests register fakes that record
 *    invocations and return canned results.
 *  - Persistence is disabled (`persist: false`) so we don't have to wire
 *    a SQLite mock — that's covered by the chatHistoryRepo tests.
 */

import type { AxiosAdapter, AxiosResponse } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';

// Mock expo-sqlite so the transitive import inside agentLoop's dependency
// graph (chatHistoryRepo → database) doesn't try to load the native module
// in a Node test environment.
jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(),
    getFirstAsync: jest.fn(async () => ({ user_version: 1 })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
    closeAsync: jest.fn(),
  })),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  store.set('nexus_openai_apiKey', 'sk-test-fixture');
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => {
      store.clear();
      store.set('nexus_openai_apiKey', 'sk-test-fixture');
    },
  };
});

import { __internal as apiInternal } from '../../src/services/apiClient';
import { runAgent, DEFAULT_MAX_ITERATIONS } from '../../src/agent/agentLoop';
import { __resetForTests as resetRegistry, register } from '../../src/agent/toolRegistry';
import type { JsonSchemaObject, NexusTool } from '../../src/types/agent';
import { NexusError, type Result, err, ok } from '../../src/types/auth';
import * as SecureStoreReal from 'expo-secure-store';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

// ── OpenAI completion script helper ─────────────────────────────────────

interface Completion {
  readonly content: string | null;
  readonly toolCalls?: readonly {
    readonly id: string;
    readonly name: string;
    readonly arguments: string;
  }[];
  readonly finishReason: 'stop' | 'tool_calls' | 'content_filter';
}

interface SeenBody {
  readonly messages: readonly Record<string, unknown>[];
}
const buildOpenAiAdapter = (script: readonly Completion[]): {
  adapter: AxiosAdapter;
  bodies: SeenBody[];
} => {
  const bodies: SeenBody[] = [];
  let i = 0;
  const adapter: AxiosAdapter = async (config) => {
    // Axios `transformRequest` JSON-stringifies object bodies before the
    // adapter sees them — parse so the test can assert on shape.
    const raw = config.data;
    const parsed: unknown =
      typeof raw === 'string' ? JSON.parse(raw) : raw;
    bodies.push(parsed as SeenBody);
    const next = script[i] ?? script[script.length - 1];
    i += 1;
    if (next === undefined) {
      throw new AxiosError('script exhausted', '500', config, undefined, undefined);
    }
    const body = {
      id: `cmpl-${i}`,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: next.content,
            ...(next.toolCalls !== undefined
              ? {
                  tool_calls: next.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.name, arguments: tc.arguments },
                  })),
                }
              : {}),
          },
          finish_reason: next.finishReason,
        },
      ],
    };
    const headers = new AxiosHeaders();
    const response: AxiosResponse = {
      data: body,
      status: 200,
      statusText: 'OK',
      headers,
      config,
    };
    return response;
  };
  return { adapter, bodies };
};

// ── Fake tools ──────────────────────────────────────────────────────────

const buildFakeTool = (
  name: string,
  schema: JsonSchemaObject,
  result: Result<unknown, NexusError>,
): NexusTool<unknown> & { calls: number } => {
  const tool: NexusTool<unknown> & { calls: number } = {
    name,
    description: `Fake tool ${name}`,
    inputSchema: schema,
    isDestructive: false,
    calls: 0,
    execute: async () => {
      tool.calls += 1;
      return result;
    },
  };
  return tool;
};

// ── Lifecycle ───────────────────────────────────────────────────────────

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  apiInternal.resetForTests();
  resetRegistry();
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('runAgent — straight response (no tool call)', () => {
  it('returns the assistant text with stop reason "stop"', async () => {
    const { adapter } = buildOpenAiAdapter([
      { content: 'Hi there!', finishReason: 'stop' },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'hello', persist: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe('Hi there!');
      expect(result.value.stopReason).toBe('stop');
      expect(result.value.iterations).toBe(1);
      expect(result.value.toolCalls).toEqual([]);
    }
  });

  it('errors out when OpenAI returns zero choices', async () => {
    const adapter: AxiosAdapter = async (config) => {
      const headers = new AxiosHeaders();
      return {
        data: { id: 'cmpl-x', choices: [] },
        status: 200,
        statusText: 'OK',
        headers,
        config,
      };
    };
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'hello', persist: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
    }
  });

  it('returns a templated message when finish_reason is content_filter', async () => {
    const { adapter } = buildOpenAiAdapter([
      // Some OpenAI safety responses come back with a non-null content
      // alongside content_filter; some don't. Either way, we render a
      // templated apology so the user sees something coherent.
      { content: null, finishReason: 'content_filter' },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'flagged content', persist: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stopReason).toBe('stop');
      expect(result.value.text).toContain('content filter');
    }
  });

  it('returns TOKEN_NOT_FOUND when no OpenAI key is configured', async () => {
    SecureStore.__reset();
    // Wipe the seeded key.
    await (SecureStoreReal as { deleteItemAsync: (k: string) => Promise<void> }).deleteItemAsync(
      'nexus_openai_apiKey',
    );

    const result = await runAgent({ userMessage: 'hi', persist: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
  });
});

describe('runAgent — single tool call success', () => {
  it('routes the call through the registry, validates, and feeds back', async () => {
    const fake = buildFakeTool(
      'gmail_read',
      {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } },
        required: [],
      },
      ok([{ id: 'm1', from: 'a@b.c', subject: 'Hi', snippet: '...' }]),
    );
    register(fake);

    const { adapter, bodies } = buildOpenAiAdapter([
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [
          { id: 'call-1', name: 'gmail_read', arguments: JSON.stringify({ limit: 1 }) },
        ],
      },
      { content: "You have one new email from a@b.c.", finishReason: 'stop' },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'check my mail', persist: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('one new email');
      expect(result.value.iterations).toBe(2);
      expect(result.value.toolCalls).toEqual([{ name: 'gmail_read', ok: true }]);
    }
    expect(fake.calls).toBe(1);

    // The second OpenAI request body must contain a `tool` message with the
    // serialized tool result, indexed by tool_call_id.
    const secondBody = bodies[1];
    expect(secondBody).toBeDefined();
    const toolMessage = secondBody?.messages.find((m) => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.tool_call_id).toBe('call-1');
    expect(typeof toolMessage?.content).toBe('string');
    expect(String(toolMessage?.content)).toContain('a@b.c');
  });
});

describe('runAgent — tool failure propagation', () => {
  it('feeds the tool error back to the model and continues', async () => {
    const fake = buildFakeTool(
      'gmail_read',
      {
        type: 'object',
        properties: { limit: { type: 'integer' } },
        required: [],
      },
      err(new NexusError('SESSION_EXPIRED', 'reconnect google')),
    );
    register(fake);

    const { adapter, bodies } = buildOpenAiAdapter([
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [
          { id: 'call-1', name: 'gmail_read', arguments: '{}' },
        ],
      },
      {
        content: 'I could not check your inbox — please reconnect Gmail in Vault.',
        finishReason: 'stop',
      },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'inbox?', persist: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCalls).toEqual([{ name: 'gmail_read', ok: false }]);
      expect(result.value.text).toContain('reconnect');
    }

    const secondBody = bodies[1];
    expect(secondBody).toBeDefined();
    const toolMessage = secondBody?.messages.find((m) => m.role === 'tool');
    expect(String(toolMessage?.content)).toContain('SESSION_EXPIRED');
  });

  it('surfaces a NOT_FOUND tool error when the model invents a tool name', async () => {
    const { adapter } = buildOpenAiAdapter([
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [
          { id: 'call-1', name: 'made_up_tool', arguments: '{}' },
        ],
      },
      { content: 'nope, sorry', finishReason: 'stop' },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'do magic', persist: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCalls).toEqual([{ name: 'made_up_tool', ok: false }]);
    }
  });

  it('rejects malformed tool arguments without invoking execute()', async () => {
    const fake = buildFakeTool(
      'gmail_read',
      {
        type: 'object',
        properties: { limit: { type: 'integer' } },
        required: ['limit'],
      },
      ok([]),
    );
    register(fake);

    const { adapter } = buildOpenAiAdapter([
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [
          // Missing required `limit`.
          { id: 'call-1', name: 'gmail_read', arguments: '{}' },
        ],
      },
      { content: 'fixed', finishReason: 'stop' },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({ userMessage: 'inbox', persist: false });
    expect(result.ok).toBe(true);
    expect(fake.calls).toBe(0);
    if (result.ok) {
      expect(result.value.toolCalls).toEqual([{ name: 'gmail_read', ok: false }]);
    }
  });
});

describe('runAgent — max_iterations guard', () => {
  it('returns stopReason "max_iterations" when the loop never reaches stop', async () => {
    const fake = buildFakeTool(
      'gmail_read',
      { type: 'object', properties: {}, required: [] },
      ok([]),
    );
    register(fake);

    // Every completion calls the tool again — never finishes naturally.
    const { adapter } = buildOpenAiAdapter([
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'c', name: 'gmail_read', arguments: '{}' }],
      },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await runAgent({
      userMessage: 'loop',
      persist: false,
      maxIterations: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stopReason).toBe('max_iterations');
      expect(result.value.iterations).toBe(3);
      expect(result.value.toolCalls).toHaveLength(3);
    }
  });

  it('uses the documented default of 10 when not overridden', () => {
    expect(DEFAULT_MAX_ITERATIONS).toBe(10);
  });
});
