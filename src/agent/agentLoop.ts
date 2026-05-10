/**
 * Recursive agent loop.
 *
 * Implements the engineering directive's exact execution model:
 *
 *   STEP 1: build messages (system prompt + history + new user msg)
 *   STEP 2: call OpenAI chat completions with tool definitions
 *   STEP 3: branch on finish_reason
 *     - 'stop'           -> append assistant message, return ok
 *     - 'tool_calls'     -> proceed to STEP 4
 *     - 'content_filter' -> append safe error message, return ok
 *     - 'length'         -> append truncation message, return ok
 *   STEP 4: for each tool_call:
 *     a. if isDestructive: setPendingAction, transition to requires_action,
 *        await user confirmation. On cancel return cancellation tool result.
 *     b. dispatch through toolExecutor (always returns a ToolResult)
 *     c. append role:'tool' message with the result
 *   STEP 5: recurse — back to STEP 2 with the augmented messages
 *   STEP 6: hard cap 10 iterations — synthetic timeout message + return
 *
 * Every external collaborator is injected so the loop is testable end-to-
 * end against pure stubs.
 */

import {
  type ChatCompletionResponse,
  type OpenAiMessage,
} from '../types/tools';
import {
  type Message,
  type PendingAction,
  type ToolCall,
  type ToolResult,
} from '../types/agent';
import { NexusError, type Provider, type Result, err, ok } from '../types/auth';
import { logEvent } from '../utils/logger';

import { getOpenAiToolDefinitions, getTool } from './toolRegistry';
import * as systemPrompt from './systemPrompt';

const MAX_ITERATIONS = 10 as const;

export interface AgentDeps {
  readonly chat: (
    messages: readonly OpenAiMessage[],
    tools: readonly unknown[],
  ) => Promise<Result<ChatCompletionResponse, NexusError>>;
  readonly executeTool: (call: ToolCall) => Promise<ToolResult>;
  readonly getHistory: () => readonly Message[];
  readonly appendMessage: (msg: Message) => void;
  readonly setStatus: (status: 'processing_intent' | 'executing_tool' | 'requires_action' | 'idle') => void;
  readonly setCurrentTool: (toolName: string | null) => void;
  readonly setPendingAction: (action: PendingAction | null) => void;
  readonly awaitConfirmation: () => Promise<{ confirmed: boolean }>;
  readonly getPreferences: () => Readonly<Record<string, string>>;
  readonly getConnectedProviders: () => readonly Provider[];
  readonly now: () => Date;
  readonly timezone: () => string;
}

const renderHistoryToOpenAi = (history: readonly Message[]): OpenAiMessage[] => {
  const out: OpenAiMessage[] = [];
  for (const m of history) {
    if (m.role === 'tool') {
      out.push({
        role: 'tool',
        content: m.content,
        ...(m.toolCallId !== undefined ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolName !== undefined ? { name: m.toolName } : {}),
      });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      out.push({
        role: 'assistant',
        content: m.content.length > 0 ? m.content : null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
};

const parseLlmToolCalls = (response: ChatCompletionResponse): readonly ToolCall[] => {
  const choice = response.choices[0];
  if (!choice) return [];
  const raw = choice.message.tool_calls ?? [];
  const out: ToolCall[] = [];
  for (const tc of raw) {
    if (tc.type !== 'function') continue;
    let parsed: Record<string, unknown> = {};
    try {
      const decoded: unknown = JSON.parse(tc.function.arguments || '{}');
      if (decoded !== null && typeof decoded === 'object') {
        parsed = decoded as Record<string, unknown>;
      }
    } catch {
      // Malformed JSON from the LLM is recovered as empty args; the
      // executor's parseParams will then return INVALID_INPUT and the
      // LLM gets a semantic error reason rather than a crash.
      parsed = {};
    }
    out.push({ id: tc.id, name: tc.function.name, arguments: parsed });
  }
  return out;
};

interface RunOk { readonly status: 'completed' | 'iteration_cap' | 'content_filter' }

/**
 * Run a single agent turn end-to-end. Returns ok with a status discriminator
 * so the caller can update analytics; never returns Err for a tool failure
 * (those are surfaced semantically to the LLM and ultimately the user).
 */
export const runAgentTurn = async (
  userMessage: string,
  deps: AgentDeps,
): Promise<Result<RunOk, NexusError>> => {
  if (userMessage.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'user message cannot be empty.'));
  }

  const turnStart = Date.now();
  deps.setStatus('processing_intent');
  deps.appendMessage({ role: 'user', content: userMessage });

  const system = systemPrompt.build({
    now: deps.now(),
    timezone: deps.timezone(),
    preferences: deps.getPreferences(),
    connectedProviders: deps.getConnectedProviders(),
  });

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    const messages: OpenAiMessage[] = [
      { role: 'system', content: system },
      ...renderHistoryToOpenAi(deps.getHistory()),
    ];
    const response = await deps.chat(messages, getOpenAiToolDefinitions());
    if (!response.ok) {
      deps.appendMessage({
        role: 'assistant',
        content: `Sorry — I couldn't reach the model (${response.error.code}). Please try again.`,
      });
      deps.setStatus('idle');
      return err(response.error);
    }

    const choice = response.value.choices[0];
    if (!choice) {
      deps.appendMessage({
        role: 'assistant',
        content: 'Sorry — the model returned an empty response.',
      });
      deps.setStatus('idle');
      return ok({ status: 'completed' });
    }

    const finish = choice.finish_reason;

    if (finish === 'content_filter') {
      deps.appendMessage({
        role: 'assistant',
        content:
          "I can't help with that — the request was blocked by the model's safety filter. Try rephrasing.",
      });
      deps.setStatus('idle');
      logEvent('agent_turn_complete', {
        finish_reason: 'content_filter',
        iteration,
        total_latency_ms: Date.now() - turnStart,
      });
      return ok({ status: 'content_filter' });
    }

    if (finish === 'stop' || finish === 'length') {
      const content = choice.message.content ?? '';
      deps.appendMessage({
        role: 'assistant',
        content:
          content.length > 0
            ? content
            : 'Sorry — the model returned no content.',
      });
      deps.setStatus('idle');
      logEvent('agent_turn_complete', {
        finish_reason: finish,
        iteration,
        total_latency_ms: Date.now() - turnStart,
      });
      return ok({ status: 'completed' });
    }

    if (finish !== 'tool_calls') {
      deps.appendMessage({
        role: 'assistant',
        content: `Sorry — unexpected response (${finish}).`,
      });
      deps.setStatus('idle');
      return ok({ status: 'completed' });
    }

    const toolCalls = parseLlmToolCalls(response.value);
    if (toolCalls.length === 0) {
      deps.appendMessage({
        role: 'assistant',
        content: 'Sorry — the model requested a tool but the call was malformed.',
      });
      deps.setStatus('idle');
      return ok({ status: 'completed' });
    }

    deps.appendMessage({
      role: 'assistant',
      content: '',
      toolCalls,
    });

    deps.setStatus('executing_tool');
    for (const call of toolCalls) {
      deps.setCurrentTool(call.name);
      const tool = getTool(call.name);
      let toolResult: ToolResult;

      if (tool && tool.isDestructive) {
        const parsed = tool.parseParams(call.arguments);
        if (!parsed.ok) {
          toolResult = {
            ok: false,
            reason: `Invalid input: ${parsed.error.message}`,
          };
        } else {
          deps.setPendingAction({
            toolName: call.name,
            toolCallId: call.id,
            parameters: call.arguments,
            displaySummary: tool.summarize(parsed.value as never),
          });
          deps.setStatus('requires_action');
          const decision = await deps.awaitConfirmation();
          deps.setPendingAction(null);
          deps.setStatus('executing_tool');
          if (!decision.confirmed) {
            toolResult = { ok: true, content: 'User cancelled this action.' };
          } else {
            toolResult = await deps.executeTool(call);
          }
        }
      } else {
        toolResult = await deps.executeTool(call);
      }

      const toolContent = toolResult.ok
        ? toolResult.content
        : `Error: ${toolResult.reason}`;
      deps.appendMessage({
        role: 'tool',
        content: toolContent,
        toolCallId: call.id,
        toolName: call.name,
      });
    }
    deps.setCurrentTool(null);
  }

  // Iteration cap reached.
  deps.appendMessage({
    role: 'assistant',
    content:
      "I couldn't complete this in 10 steps. Please rephrase or break it into smaller asks.",
  });
  deps.setStatus('idle');
  logEvent('agent_turn_iteration_cap', {
    iteration: MAX_ITERATIONS,
    total_latency_ms: Date.now() - turnStart,
  });
  return ok({ status: 'iteration_cap' });
};

export const __internal = { MAX_ITERATIONS, renderHistoryToOpenAi, parseLlmToolCalls };
