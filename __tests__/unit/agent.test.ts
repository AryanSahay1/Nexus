/**
 * Unit tests for the agent core: toolRegistry, toolExecutor, systemPrompt,
 * and most importantly agentLoop.
 *
 * agentLoop is the single most important state machine in the application.
 * Every transition, every confirmation gate, every iteration boundary, and
 * every error path is fixed in place by these tests.
 */

import * as SecureStoreReal from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
    __store: store,
  };
});
jest.mock('expo-sqlite/next', () => ({ __esModule: true, openDatabaseAsync: async () => null }));
jest.mock('expo-sqlite', () => ({ __esModule: true }));

// eslint-disable-next-line import/first
import { type ChatCompletionResponse } from '../../src/types/tools';
// eslint-disable-next-line import/first
import { type Message, type PendingAction, type ToolCall, type ToolResult } from '../../src/types/agent';
// eslint-disable-next-line import/first
import { type Provider, type Result, ok } from '../../src/types/auth';
// eslint-disable-next-line import/first
import { runAgentTurn, __internal as agentInternals, type AgentDeps } from '../../src/agent/agentLoop';
// eslint-disable-next-line import/first
import { execute } from '../../src/agent/toolExecutor';
// eslint-disable-next-line import/first
import { getOpenAiToolDefinitions, getTool, __internal as registryInternals } from '../../src/agent/toolRegistry';
// eslint-disable-next-line import/first
import * as systemPrompt from '../../src/agent/systemPrompt';

beforeEach(() => {
  (SecureStoreReal as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

// ── Helpers ---------------------------------------------------------------

interface DepsHarness {
  history: Message[];
  statuses: string[];
  currentTools: (string | null)[];
  pendingActions: (PendingAction | null)[];
  toolCallsExecuted: ToolCall[];
  resolveConfirmation?: (decision: { confirmed: boolean }) => void;
  deps: AgentDeps;
}

const makeDeps = (
  scriptedResponses: Result<ChatCompletionResponse, Error>[],
  scriptedToolResults: Map<string, ToolResult>,
  options: {
    autoConfirm?: boolean;
    autoCancel?: boolean;
    preferences?: Record<string, string>;
    connected?: readonly Provider[];
  } = {},
): DepsHarness => {
  const harness: DepsHarness = {
    history: [],
    statuses: [],
    currentTools: [],
    pendingActions: [],
    toolCallsExecuted: [],
    deps: {} as AgentDeps,
  };
  let responseIndex = 0;
  harness.deps = {
    chat: async () => {
      const out = scriptedResponses[responseIndex];
      responseIndex += 1;
      if (!out) {
        return ok({ id: 'empty', choices: [] });
      }
      return out as Result<ChatCompletionResponse, never>;
    },
    executeTool: async (call) => {
      harness.toolCallsExecuted.push(call);
      return scriptedToolResults.get(call.name) ?? { ok: false, reason: 'no scripted result' };
    },
    getHistory: () => harness.history,
    appendMessage: (msg) => {
      harness.history.push(msg);
    },
    setStatus: (status) => {
      harness.statuses.push(status);
    },
    setCurrentTool: (name) => {
      harness.currentTools.push(name);
    },
    setPendingAction: (action) => {
      harness.pendingActions.push(action);
    },
    awaitConfirmation: async () => {
      if (options.autoConfirm) return { confirmed: true };
      if (options.autoCancel) return { confirmed: false };
      return new Promise((resolve) => {
        harness.resolveConfirmation = resolve;
      });
    },
    getPreferences: () => options.preferences ?? {},
    getConnectedProviders: () => options.connected ?? [],
    now: () => new Date('2030-06-15T10:00:00.000Z'),
    timezone: () => 'Asia/Kolkata',
  };
  return harness;
};

const stop = (content: string): ChatCompletionResponse => ({
  id: 'cmpl_stop',
  choices: [
    {
      finish_reason: 'stop',
      message: { role: 'assistant', content },
    },
  ],
});

const toolCall = (
  name: string,
  args: Record<string, unknown> = {},
  callId = 'call_1',
): ChatCompletionResponse => ({
  id: 'cmpl_tools',
  choices: [
    {
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: callId,
            type: 'function',
            function: { name, arguments: JSON.stringify(args) },
          },
        ],
      },
    },
  ],
});

// ── toolRegistry ----------------------------------------------------------

describe('toolRegistry', () => {
  it('exports a stable, frozen list of tool entries', () => {
    expect(registryInternals.ALL_ENTRIES.length).toBeGreaterThan(0);
    expect(Object.isFrozen(registryInternals.ALL_ENTRIES)).toBe(true);
  });

  it('every entry has a unique tool name', () => {
    const names = new Set<string>();
    for (const e of registryInternals.ALL_ENTRIES) {
      expect(names.has(e.name)).toBe(false);
      names.add(e.name);
    }
  });

  it('getOpenAiToolDefinitions returns one definition per tool', () => {
    const defs = getOpenAiToolDefinitions();
    expect(defs.length).toBe(registryInternals.ALL_ENTRIES.length);
    for (const d of defs) expect(d.type).toBe('function');
  });

  it('isDestructive flag matches the directive: gmail_send_email and google_calendar_create_event are destructive', () => {
    expect(getTool('gmail_send_email')?.isDestructive).toBe(true);
    expect(getTool('google_calendar_create_event')?.isDestructive).toBe(true);
    expect(getTool('gmail_read_recent')?.isDestructive).toBe(false);
    expect(getTool('google_calendar_get_next')?.isDestructive).toBe(false);
    expect(getTool('system_contacts_search')?.isDestructive).toBe(false);
  });
});

// ── toolExecutor ----------------------------------------------------------

describe('toolExecutor', () => {
  it('returns ok=false reason on an unknown tool name', async () => {
    const result = await execute({ id: 'c', name: 'no_such_tool', arguments: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Unknown tool');
  });

  it('returns ok=false reason on invalid input parameters', async () => {
    const result = await execute({
      id: 'c',
      name: 'gmail_send_email',
      arguments: { to: 'a@b.com' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Invalid input');
  });
});

// ── systemPrompt ----------------------------------------------------------

describe('systemPrompt.build', () => {
  it('is deterministic for fixed inputs', () => {
    const a = systemPrompt.build({
      now: new Date('2030-06-15T10:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      preferences: { email_tone: 'professional' },
      connectedProviders: ['google'],
    });
    const b = systemPrompt.build({
      now: new Date('2030-06-15T10:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      preferences: { email_tone: 'professional' },
      connectedProviders: ['google'],
    });
    expect(a).toBe(b);
  });

  it('includes the timezone, every preference key, and the connected services', () => {
    const out = systemPrompt.build({
      now: new Date('2030-06-15T10:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      preferences: { email_tone: 'professional', wife_phone: '+919876543210' },
      connectedProviders: ['google', 'openai'],
    });
    expect(out).toContain('Asia/Kolkata');
    expect(out).toContain('email_tone: professional');
    expect(out).toContain('wife_phone: +919876543210');
    expect(out).toContain('Gmail + Google Calendar');
    expect(out).toContain('OpenAI');
    expect(out).toContain('confirm before sending');
  });

  it('renders an empty-prefs fallback when no preferences exist', () => {
    const out = systemPrompt.build({
      now: new Date('2030-06-15T10:00:00.000Z'),
      timezone: 'UTC',
      preferences: {},
      connectedProviders: [],
    });
    expect(out).toContain('(no preferences set)');
    expect(out).toContain('(none — ask the user');
  });
});

// ── agentLoop -------------------------------------------------------------

describe('agentLoop.runAgentTurn', () => {
  it('rejects an empty user message before doing anything', async () => {
    const h = makeDeps([], new Map());
    const r = await runAgentTurn('   ', h.deps);
    expect(r.ok).toBe(false);
    expect(h.statuses).toEqual([]);
    expect(h.history).toEqual([]);
  });

  it('a stop response appends one assistant message and returns to idle', async () => {
    const h = makeDeps([ok(stop('Hello!'))], new Map());
    const r = await runAgentTurn('hi', h.deps);
    expect(r.ok).toBe(true);
    expect(h.history.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(h.history[1]?.content).toBe('Hello!');
    expect(h.statuses[h.statuses.length - 1]).toBe('idle');
  });

  it('a single non-destructive tool call: dispatch -> tool result -> stop', async () => {
    const h = makeDeps(
      [
        ok(toolCall('gmail_read_recent', { limit: 3 })),
        ok(stop('Here are your 3 most recent emails.')),
      ],
      new Map([['gmail_read_recent', { ok: true, content: '{"messages":[]}' } as ToolResult]]),
    );
    const r = await runAgentTurn('show my last 3 emails', h.deps);
    expect(r.ok).toBe(true);
    expect(h.toolCallsExecuted.map((c) => c.name)).toEqual(['gmail_read_recent']);
    expect(h.history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(h.history[2]?.content).toContain('messages');
    expect(h.history[3]?.content).toContain('recent emails');
  });

  it('a destructive tool call PAUSES on requires_action and resumes on confirm', async () => {
    const h = makeDeps(
      [
        ok(
          toolCall('gmail_send_email', {
            to: 'a@b.com',
            subject: 'Hi',
            body: 'hello',
          }),
        ),
        ok(stop('Email sent.')),
      ],
      new Map([
        ['gmail_send_email', { ok: true, content: '{"id":"sent_1","threadId":"t1"}' } as ToolResult],
      ]),
      { autoConfirm: true },
    );
    const r = await runAgentTurn('send an email to a@b.com saying hi', h.deps);
    expect(r.ok).toBe(true);
    expect(h.statuses).toContain('requires_action');
    expect(h.pendingActions[0]?.toolName).toBe('gmail_send_email');
    expect(h.pendingActions[h.pendingActions.length - 1]).toBeNull();
    expect(h.toolCallsExecuted.map((c) => c.name)).toEqual(['gmail_send_email']);
  });

  it('a destructive tool call CANCELLED returns the cancellation message and never executes', async () => {
    const h = makeDeps(
      [
        ok(
          toolCall('gmail_send_email', {
            to: 'a@b.com',
            subject: 'Hi',
            body: 'hello',
          }),
        ),
        ok(stop('Okay, I cancelled it.')),
      ],
      new Map(),
      { autoCancel: true },
    );
    const r = await runAgentTurn('send an email', h.deps);
    expect(r.ok).toBe(true);
    expect(h.toolCallsExecuted).toHaveLength(0);
    const toolMessage = h.history.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toBe('User cancelled this action.');
  });

  it('a destructive tool with INVALID arguments returns Invalid input WITHOUT pausing', async () => {
    const h = makeDeps(
      [
        ok(
          toolCall('gmail_send_email', {
            to: 'a@b.com',
            // missing subject + body
          }),
        ),
        ok(stop('Cannot send.')),
      ],
      new Map(),
      { autoConfirm: true },
    );
    const r = await runAgentTurn('send an email', h.deps);
    expect(r.ok).toBe(true);
    expect(h.statuses).not.toContain('requires_action');
    expect(h.toolCallsExecuted).toHaveLength(0);
    const toolMsg = h.history.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Invalid input');
  });

  it('a chained two-tool turn: contacts.search -> gmail_send_email (destructive)', async () => {
    const h = makeDeps(
      [
        ok(toolCall('system_contacts_search', { query: 'brother' }, 'call_a')),
        ok(
          toolCall(
            'gmail_send_email',
            { to: 'rahul@example.com', subject: 'Hi', body: 'on my way' },
            'call_b',
          ),
        ),
        ok(stop('Sent.')),
      ],
      new Map<string, ToolResult>([
        [
          'system_contacts_search',
          {
            ok: true,
            content:
              '{"matches":[{"name":"Rahul","phoneNumber":"+919876543210","label":"mobile"}]}',
          },
        ],
        ['gmail_send_email', { ok: true, content: '{"id":"sent_1","threadId":"t1"}' }],
      ]),
      { autoConfirm: true },
    );
    const r = await runAgentTurn('email my brother saying on my way', h.deps);
    expect(r.ok).toBe(true);
    expect(h.toolCallsExecuted.map((c) => c.name)).toEqual([
      'system_contacts_search',
      'gmail_send_email',
    ]);
    expect(h.statuses.filter((s) => s === 'requires_action')).toHaveLength(1);
  });

  it('a tool that returns ok=false produces a role:tool message starting with "Error:"', async () => {
    const h = makeDeps(
      [
        ok(toolCall('gmail_read_recent', { limit: 3 })),
        ok(stop('Sorry — Gmail is rate limiting.')),
      ],
      new Map([
        ['gmail_read_recent', { ok: false, reason: 'RATE_LIMITED' } as ToolResult],
      ]),
    );
    const r = await runAgentTurn('show my emails', h.deps);
    expect(r.ok).toBe(true);
    const toolMsg = h.history.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('Error:');
    expect(toolMsg?.content).toContain('RATE_LIMITED');
  });

  it('hits the iteration cap when the model never returns a stop', async () => {
    const responses: Result<ChatCompletionResponse, Error>[] = [];
    for (let i = 0; i < agentInternals.MAX_ITERATIONS + 5; i += 1) {
      responses.push(ok(toolCall('gmail_read_recent', { limit: 1 }, `c_${i}`)));
    }
    const h = makeDeps(
      responses,
      new Map([['gmail_read_recent', { ok: true, content: '{}' } as ToolResult]]),
    );
    const r = await runAgentTurn('something', h.deps);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe('iteration_cap');
    const final = h.history[h.history.length - 1];
    expect(final?.role).toBe('assistant');
    expect(final?.content).toContain("couldn't complete this in 10 steps");
    // Tool dispatched exactly MAX_ITERATIONS times and never more.
    expect(h.toolCallsExecuted.length).toBe(agentInternals.MAX_ITERATIONS);
  });

  it('content_filter finish_reason yields a safe assistant message', async () => {
    const filtered: ChatCompletionResponse = {
      id: 'f',
      choices: [
        {
          finish_reason: 'content_filter',
          message: { role: 'assistant', content: null },
        },
      ],
    };
    const h = makeDeps([ok(filtered)], new Map());
    const r = await runAgentTurn('something', h.deps);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe('content_filter');
    expect(h.history[h.history.length - 1]?.content).toContain('safety filter');
  });

  it('handles malformed tool-call arguments JSON without crashing', async () => {
    const malformed: ChatCompletionResponse = {
      id: 'm',
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'c',
                type: 'function',
                function: { name: 'gmail_read_recent', arguments: '{not json' },
              },
            ],
          },
        },
      ],
    };
    const h = makeDeps(
      [ok(malformed), ok(stop('done'))],
      new Map([['gmail_read_recent', { ok: true, content: '{}' } as ToolResult]]),
    );
    const r = await runAgentTurn('show emails', h.deps);
    expect(r.ok).toBe(true);
    expect(h.toolCallsExecuted).toHaveLength(1);
    expect(h.toolCallsExecuted[0]?.arguments).toEqual({});
  });

  it('returns Err and writes a friendly assistant message when chat() itself fails', async () => {
    const h = makeDeps(
      [{ ok: false, error: new Error('network down') as never } as Result<ChatCompletionResponse, never>],
      new Map(),
    );
    // We can't construct an Err with NexusError easily without imports — fake via casting:
    // (Use the public path: chat returning Err)
    const result = await runAgentTurn('hi', h.deps);
    expect(result.ok).toBe(false);
    expect(h.history[h.history.length - 1]?.role).toBe('assistant');
    expect(h.statuses[h.statuses.length - 1]).toBe('idle');
  });
});
