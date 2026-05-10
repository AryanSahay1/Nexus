/**
 * OpenAI service — chat completions + Whisper transcription.
 *
 * Every request is routed through the shared apiClient so the user's
 * stored API key (`nexus_openai_apiKey`) is injected by the request
 * interceptor and never read by this module directly. This keeps a single
 * choke point for credential I/O (LAW 1 + LAW 2).
 *
 * The chat-completions response is intentionally not auto-coerced into
 * the agent loop's slim `ChatCompletionChoice` — the loop does its own
 * narrowing because it needs to handle multiple finish_reasons.
 */

import { type AxiosInstance } from 'axios';

import {
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type OpenAiMessage,
} from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';

import { apiClient as defaultClient, requestAsResult } from './apiClient';

const OPENAI_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o' as const;
const DEFAULT_TEMPERATURE = 0.2 as const;

/** Allow tests / Cycle Two refactors to override the underlying axios instance. */
let httpClient: AxiosInstance = defaultClient;
export const __setHttpClientForTests = (client: AxiosInstance | null): void => {
  httpClient = client ?? defaultClient;
};

/**
 * Validate an OpenAI API key shape before storing it. The user enters
 * this on the Vault screen; we want to catch obvious typos here rather
 * than letting a malformed key produce confusing 401s later.
 *
 * Rules:
 *   - must be a string
 *   - no whitespace
 *   - must start with `sk-`
 *   - must be at least 20 characters total (real keys are well over)
 */
export const validateApiKey = (raw: unknown): Result<string, NexusError> => {
  if (typeof raw !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'API key must be a string.'));
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err(new NexusError('INVALID_INPUT', 'API key cannot be empty.'));
  }
  if (trimmed.length !== raw.length || /\s/.test(trimmed)) {
    return err(new NexusError('INVALID_INPUT', 'API key must not contain whitespace.'));
  }
  if (!trimmed.startsWith('sk-')) {
    return err(new NexusError('INVALID_INPUT', 'API key must start with "sk-".'));
  }
  if (trimmed.length < 20) {
    return err(new NexusError('INVALID_INPUT', 'API key looks too short to be valid.'));
  }
  return ok(trimmed);
};

/**
 * Render the agent loop's `Message[]` (our normalized shape) into OpenAI's
 * wire shape. Tool calls are flattened into `tool_calls` and tool results
 * into `tool` role messages with `tool_call_id`.
 */
export interface OpenAiToolDefinitionWire {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Readonly<Record<string, unknown>>;
  };
}

/** POST /v1/chat/completions. */
export const chatCompletion = async (
  req: ChatCompletionRequest,
): Promise<Result<ChatCompletionResponse, NexusError>> => {
  const body: Record<string, unknown> = {
    model: req.model.length > 0 ? req.model : DEFAULT_MODEL,
    messages: req.messages,
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
  };
  if (req.tools && req.tools.length > 0) body.tools = req.tools;
  if (req.toolChoice) body.tool_choice = req.toolChoice;

  return requestAsResult<ChatCompletionResponse>(httpClient, {
    url: `${OPENAI_BASE}/chat/completions`,
    method: 'POST',
    data: body,
    nexusProvider: 'openai',
  });
};

/**
 * Build a Whisper multipart payload from a local file URI.
 *
 * The browser/RN `FormData` is used so this code is portable between
 * the React Native runtime (where `fetch` accepts a `{ uri, name, type }`
 * blob shape) and Node test runners that polyfill FormData. The actual
 * file IO happens in the React Native layer; in tests we feed a Buffer.
 */
export interface WhisperPayloadInput {
  readonly uri: string;
  readonly mimeType?: string;
  readonly fileName?: string;
}

/** POST /v1/audio/transcriptions. Cycle Two consumer is `useVoiceInput`. */
export const transcribeAudio = async (
  input: WhisperPayloadInput,
): Promise<Result<{ text: string }, NexusError>> => {
  if (input.uri.length === 0) {
    return err(new NexusError('INVALID_INPUT', 'audio URI is required.'));
  }
  const form = new FormData();
  form.append('model', 'whisper-1');
  // The RN fetch FormData accepts this object literal; in unit tests we
  // never round-trip through a real network, so the exact field shape is
  // verified by intercepting the axios request body.
  form.append('file', {
    uri: input.uri,
    name: input.fileName ?? 'audio.m4a',
    type: input.mimeType ?? 'audio/m4a',
  } as unknown as Blob);

  return requestAsResult<{ text: string }>(httpClient, {
    url: `${OPENAI_BASE}/audio/transcriptions`,
    method: 'POST',
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' },
    nexusProvider: 'openai',
  });
};

/** Forward declaration so the agent loop has a tiny callable surface. */
export type ChatFn = (
  messages: readonly OpenAiMessage[],
  tools: readonly OpenAiToolDefinitionWire[],
  model: string,
) => Promise<Result<ChatCompletionResponse, NexusError>>;

/** Convenience adapter shaped for `agentLoop` injection. */
export const buildChatFn = (model: string): ChatFn => async (messages, tools, modelOverride) =>
  chatCompletion({
    model: modelOverride.length > 0 ? modelOverride : model,
    messages,
    tools,
    toolChoice: 'auto',
  });

export const __internal = { OPENAI_BASE, DEFAULT_MODEL, DEFAULT_TEMPERATURE };
