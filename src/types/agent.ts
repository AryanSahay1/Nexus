/**
 * Agent runtime contracts.
 *
 * These types are the boundary between the LLM (OpenAI), the agent loop,
 * the tool executor, and the chat store. They are deliberately narrower
 * than the OpenAI SDK's surface so that future provider swaps don't ripple
 * through the rest of the codebase.
 */

/** Discrete states of the agent state machine (mirrors the engineering directive). */
export type AgentStatus = 'idle' | 'processing_intent' | 'executing_tool' | 'requires_action';

/** A single tool call request emitted by the LLM. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/** A normalized chat message — covers user, assistant, system, and tool turns. */
export interface Message {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCalls?: readonly ToolCall[];
  readonly toolCallId?: string;
  readonly toolName?: string;
}

/** What the chat UI shows to the user when a destructive action is queued. */
export interface PendingAction {
  readonly toolName: string;
  readonly toolCallId: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly displaySummary: string;
}

/**
 * The agent loop's internal value passed back to the LLM after a tool call.
 *
 * `ok=true` carries a JSON-serializable string the LLM will see as the
 * tool's result. `ok=false` carries a human-readable reason that becomes
 * `Error: <reason>` in the LLM's view — the LLM is expected to apologize
 * and explain the failure to the user (per LAW 3 + the systemPrompt rule).
 */
export type ToolResult =
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly reason: string };

/**
 * The shape of an OpenAI-compatible tool definition. The runtime registry
 * exports this verbatim to the LLM via the `tools` request field.
 */
export interface OpenAiToolDefinition {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: {
      readonly type: 'object';
      readonly properties: Readonly<Record<string, OpenAiParameterDefinition>>;
      readonly required: readonly string[];
    };
  };
}

export interface OpenAiParameterDefinition {
  readonly type: 'string' | 'integer' | 'number' | 'boolean' | 'array';
  readonly description: string;
  readonly items?: { readonly type: 'string' };
  readonly enum?: readonly string[];
}

/** A `finish_reason` value the agent loop knows how to handle. */
export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter';

/** Slim chat-completion response shape consumed by the agent loop. */
export interface ChatCompletionChoice {
  readonly finishReason: FinishReason;
  readonly message: {
    readonly role: 'assistant';
    readonly content: string | null;
    readonly toolCalls?: readonly ToolCall[];
  };
}
