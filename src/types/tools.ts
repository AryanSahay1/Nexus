/**
 * Per-tool parameter and result types.
 *
 * Each tool exposes:
 *   - `<ToolName>Params`: the validated argument shape.
 *   - `<ToolName>Result`: the success-shape returned by the executor.
 *
 * Argument validation lives next to the executor in `src/tools/<file>.ts`.
 * The agent loop never sees these types directly — it goes through
 * `ToolResult` from `types/agent.ts`. They exist so that each tool's
 * unit tests can assert against a single contract.
 */

// ── Gmail ──────────────────────────────────────────────────────────────────

export interface GmailReadRecentParams {
  readonly limit: number;
  readonly query?: string;
}

export interface GmailMessageSummary {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly snippet: string;
  readonly dateIso: string | null;
}

export interface GmailReadRecentResult {
  readonly messages: readonly GmailMessageSummary[];
}

export interface GmailSendEmailParams {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export interface GmailSendEmailResult {
  readonly id: string;
  readonly threadId: string;
}

// ── Google Calendar ────────────────────────────────────────────────────────

export interface CalendarEventInput {
  readonly summary: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly timezone?: string;
  readonly description?: string;
  readonly attendees?: readonly string[];
}

export interface CalendarEvent {
  readonly id: string;
  readonly summary: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly htmlLink: string | null;
}

export interface GoogleCalendarCreateEventResult {
  readonly id: string;
  readonly htmlLink: string | null;
}

// ── Contacts ───────────────────────────────────────────────────────────────

export interface ContactsSearchParams {
  readonly query: string;
}

export interface ContactMatch {
  readonly name: string;
  readonly phoneNumber: string;
  readonly label: string | null;
}

export interface ContactsSearchResult {
  readonly matches: readonly ContactMatch[];
  readonly message?: string;
}

// ── WhatsApp (Cycle Two) ───────────────────────────────────────────────────

export interface WhatsAppSendMessageParams {
  readonly toPhoneNumber: string;
  readonly messageBody: string;
}

// ── OpenAI envelopes the chat-completions service exposes ──────────────────

export interface ChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly OpenAiMessage[];
  readonly tools?: readonly unknown[]; // OpenAiToolDefinition[] from agent.ts; widened to avoid circular imports
  readonly toolChoice?: 'auto' | 'none' | 'required';
  readonly temperature?: number;
}

export interface OpenAiMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string | null;
  readonly tool_calls?: readonly {
    readonly id: string;
    readonly type: 'function';
    readonly function: { readonly name: string; readonly arguments: string };
  }[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

export interface ChatCompletionResponse {
  readonly id: string;
  readonly choices: readonly {
    readonly finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
    readonly message: {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly tool_calls?: readonly {
        readonly id: string;
        readonly type: 'function';
        readonly function: { readonly name: string; readonly arguments: string };
      }[];
    };
  }[];
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}
