/**
 * Agent and tool types for Project Nexus.
 *
 * Tools are the LLM's actuators: each one declares a JSON-Schema input
 * shape and an `execute` method that produces a `Result`. The agent loop
 * dispatches tool calls through the registry and feeds the results back
 * to the model as `tool` messages.
 */

import type { NexusError, Result } from './auth';

// ── JSON Schema (subset Nexus actually uses) ─────────────────────────────

/**
 * Minimal JSON-Schema shape — enough for tool input validation. We never
 * accept `additionalProperties: true` and never validate against external
 * `$ref`s. Tools that need more are forced to keep their schema flat,
 * which is exactly the discipline we want for LLM-facing inputs.
 */
export interface JsonSchemaProperty {
  readonly type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  readonly description?: string;
  readonly enum?: readonly (string | number)[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly items?: JsonSchemaProperty;
  readonly properties?: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
}

export interface JsonSchemaObject extends JsonSchemaProperty {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
}

// ── Tool primitives ──────────────────────────────────────────────────────

/**
 * Every Nexus tool conforms to this shape. Inputs are typed loosely
 * (`Record<string, unknown>`) because they originate from the LLM as
 * JSON; the registry's `validateInput()` is the boundary that promotes
 * them to a known shape before `execute()` runs.
 */
export interface NexusTool<TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
  /**
   * Mutating tools (send email, create event) MUST set this to `true` so
   * the agent loop can route the call through a confirmation gate.
   */
  readonly isDestructive: boolean;
  execute: (input: Readonly<Record<string, unknown>>) => Promise<Result<TOutput, NexusError>>;
}

/** Convenience alias for the registry's `listAll` output. */
export type ToolDescriptor = Pick<NexusTool, 'name' | 'description' | 'inputSchema' | 'isDestructive'>;

// ── Agent loop messages ──────────────────────────────────────────────────

export interface ToolCallRequest {
  readonly id: string;
  readonly name: string;
  readonly arguments: string; // JSON-encoded; must be parsed before validation
}

export interface AgentMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolName?: string;
  readonly toolCalls?: readonly ToolCallRequest[];
}

export interface AgentResponse {
  readonly text: string;
  readonly iterations: number;
  readonly stopReason: 'stop' | 'max_iterations';
  readonly toolCalls: readonly { readonly name: string; readonly ok: boolean }[];
}
