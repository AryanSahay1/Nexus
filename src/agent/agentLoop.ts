/**
 * Recursive agent loop — the heart of Nexus's chat experience.
 *
 *   user prompt
 *      │
 *      ▼
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Build system prompt + history + new user message             │
 *   │    │                                                         │
 *   │    ▼                                                         │
 *   │  POST /v1/chat/completions  (apiClient, skipAuth)            │
 *   │    │                                                         │
 *   │    ▼                                                         │
 *   │  finish_reason === 'stop'        → persist + return          │
 *   │  finish_reason === 'tool_calls'  → for each tool_call:       │
 *   │                                       validate input         │
 *   │                                       execute via registry   │
 *   │                                       feed back as `tool`    │
 *   │                                    ↻ recurse                 │
 *   │  iterations exceed `maxIterations` → return max_iterations   │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Persistence: each user turn and each assistant final response is written
 * to `chat_history` via `chatHistoryRepo`. Tool messages are NOT persisted
 * — they're transient orchestration noise that bloats the table.
 */

import { nexusRequest } from '../services/apiClient';
import * as tokenService from '../services/tokenService';
import { insertMessage } from '../db/chatHistoryRepo';
import { get as getTool, listAll, validateInput } from './toolRegistry';
import type {
  AgentMessage,
  AgentResponse,
  ToolCallRequest,
  ToolDescriptor,
} from '../types/agent';
import { NexusError, type Result, err, ok } from '../types/auth';
import { logEvent, logWarn } from '../utils/logger';

// ── Tunables ────────────────────────────────────────────────────────────

export const DEFAULT_MAX_ITERATIONS = 10;
export const DEFAULT_MODEL = 'gpt-4o-mini';

// ── OpenAI wire shapes ──────────────────────────────────────────────────

interface OpenAiToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}
interface OpenAiAssistantMessage {
  readonly role: 'assistant';
  readonly content: string | null;
  readonly tool_calls?: readonly OpenAiToolCall[];
}
interface OpenAiChoice {
  readonly index: number;
  readonly message: OpenAiAssistantMessage;
  readonly finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}
interface OpenAiCompletion {
  readonly id: string;
  readonly choices: readonly OpenAiChoice[];
}

interface OpenAiChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string | null;
  readonly tool_calls?: readonly OpenAiToolCall[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

interface OpenAiToolDefinition {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolDescriptor['inputSchema'];
  };
}

// ── Public API ──────────────────────────────────────────────────────────

export interface RunAgentOptions {
  readonly userMessage: string;
  readonly history?: readonly AgentMessage[];
  readonly model?: string;
  readonly maxIterations?: number;
  /**
   * When true (default), persists user + final assistant turn to
   * `chat_history`. Disable in tests that don't want SQLite touched.
   */
  readonly persist?: boolean;
}

export const runAgent = async (
  options: RunAgentOptions,
): Promise<Result<AgentResponse, NexusError>> => {
  const apiKey = await tokenService.getToken('openai', 'apiKey');
  if (!apiKey.ok) {
    return err(
      new NexusError('TOKEN_NOT_FOUND', 'OpenAI API key is not configured. Add it in Vault.'),
    );
  }

  const model = options.model ?? DEFAULT_MODEL;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const persist = options.persist ?? true;
  const tools = listAll();
  const toolDefs: readonly OpenAiToolDefinition[] = tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const messages: OpenAiChatMessage[] = [
    {
      role: 'system',
      content:
        'You are Nexus, a private personal AI agent on the user\'s phone. ' +
        'Speak briefly, with a calm, helpful, professional tone. ' +
        'You may call tools to read or send Gmail and to list calendar events. ' +
        'Never invent data — if a tool returns an error, apologise and explain.',
    },
    ...(options.history ?? []).map(toOpenAiMessage),
    { role: 'user', content: options.userMessage },
  ];

  if (persist) {
    const persisted = await insertMessage({ role: 'user', content: options.userMessage });
    if (!persisted.ok) return persisted;
  }

  const toolCallTrace: { name: string; ok: boolean }[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const completion = await callOpenAi({
      apiKey: apiKey.value,
      model,
      messages,
      tools: toolDefs,
    });
    if (!completion.ok) return completion;

    const choice = completion.value.choices[0];
    if (choice === undefined) {
      return err(new NexusError('PROVIDER_ERROR', 'OpenAI returned zero choices.'));
    }

    const assistantMessage = choice.message;
    messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      ...(assistantMessage.tool_calls !== undefined
        ? { tool_calls: assistantMessage.tool_calls }
        : {}),
    });

    if (choice.finish_reason === 'stop' || assistantMessage.tool_calls === undefined) {
      const text = assistantMessage.content ?? '';
      if (persist) {
        const persisted = await insertMessage({ role: 'assistant', content: text });
        if (!persisted.ok) return persisted;
      }
      logEvent('agent_loop_complete', { iteration, finish_reason: 'stop' });
      return ok({
        text,
        iterations: iteration,
        stopReason: 'stop',
        toolCalls: toolCallTrace,
      });
    }

    if (choice.finish_reason === 'content_filter') {
      const text =
        'I cannot complete that request because it was blocked by the content filter.';
      if (persist) {
        const persisted = await insertMessage({ role: 'assistant', content: text });
        if (!persisted.ok) return persisted;
      }
      return ok({
        text,
        iterations: iteration,
        stopReason: 'stop',
        toolCalls: toolCallTrace,
      });
    }

    // Run every tool call requested by the model and feed results back.
    for (const toolCall of assistantMessage.tool_calls) {
      const dispatched = await dispatchToolCall(toolCall);
      toolCallTrace.push({ name: toolCall.function.name, ok: dispatched.ok });
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: dispatched.ok
          ? JSON.stringify(dispatched.value)
          : JSON.stringify({
              error: dispatched.error.code,
              message: dispatched.error.message,
            }),
      });
    }
  }

  // Iteration cap reached — graceful timeout response.
  const text =
    "I tried several steps but couldn't finish. Could you rephrase what you'd like me to do?";
  if (persist) {
    const persisted = await insertMessage({ role: 'assistant', content: text });
    if (!persisted.ok) return persisted;
  }
  logWarn('agent_loop_max_iterations', { iteration: maxIterations });
  return ok({
    text,
    iterations: maxIterations,
    stopReason: 'max_iterations',
    toolCalls: toolCallTrace,
  });
};

// ── Helpers ─────────────────────────────────────────────────────────────

interface CallOpenAiArgs {
  readonly apiKey: string;
  readonly model: string;
  readonly messages: readonly OpenAiChatMessage[];
  readonly tools: readonly OpenAiToolDefinition[];
}

const callOpenAi = async (
  args: CallOpenAiArgs,
): Promise<Result<OpenAiCompletion, NexusError>> =>
  nexusRequest<OpenAiCompletion>({
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    skipAuth: true,
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: args.model,
      messages: args.messages,
      ...(args.tools.length > 0 ? { tools: args.tools, tool_choice: 'auto' } : {}),
    },
  });

const dispatchToolCall = async (
  toolCall: OpenAiToolCall,
): Promise<Result<unknown, NexusError>> => {
  const tool = getTool(toolCall.function.name);
  if (tool === null) {
    return err(
      new NexusError('NOT_FOUND', `Unknown tool: ${toolCall.function.name}`),
    );
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    return err(
      new NexusError(
        'INVALID_INPUT',
        `Tool "${toolCall.function.name}" arguments were not valid JSON.`,
      ),
    );
  }
  const validation = validateInput(toolCall.function.name, parsedArgs);
  if (!validation.ok) return validation;

  return tool.execute(validation.value);
};

const toOpenAiMessage = (m: AgentMessage): OpenAiChatMessage => ({
  role: m.role,
  content: m.content,
  ...(m.toolCalls !== undefined
    ? {
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: c.arguments },
        })),
      }
    : {}),
  ...(m.toolCallId !== undefined ? { tool_call_id: m.toolCallId } : {}),
  ...(m.toolName !== undefined ? { name: m.toolName } : {}),
});

/** Re-export a typed view of `ToolCallRequest` so callers don't reach into types. */
export type { ToolCallRequest };

export const __internal = { dispatchToolCall, toOpenAiMessage };
