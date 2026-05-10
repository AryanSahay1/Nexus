/**
 * Tool executor — dispatches a `ToolCall` to the registered executor.
 *
 * Wraps every executor in try/catch and produces a `ToolResult`:
 *   - on success: `{ ok: true, content: <JSON-stringified result> }`
 *   - on failure: `{ ok: false, reason: <safe message> }`
 *
 * The agent loop NEVER catches an exception out of this module — the
 * loop relies on the always-resolved `ToolResult` shape (LAW 3).
 */

import { type ToolCall, type ToolResult } from '../types/agent';
import { NexusError } from '../types/auth';
import { logEvent, logError } from '../utils/logger';

import { getTool, type AnyToolEntry } from './toolRegistry';

const reasonForError = (error: unknown): string => {
  if (error instanceof NexusError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message.length > 0 ? error.message : 'unknown error';
  }
  return 'unknown error';
};

export interface ExecuteOptions {
  /**
   * Treat as already confirmed. Used in the agent loop AFTER the user has
   * approved the action via the ConfirmationCard. The executor here does
   * not care about the flag — it's the agentLoop's responsibility to gate
   * isDestructive tools on this. Provided for symmetry / future hooks.
   */
  readonly preApproved?: boolean;
}

export const execute = async (
  call: ToolCall,
  options: ExecuteOptions = {},
): Promise<ToolResult> => {
  const tool = getTool(call.name);
  if (!tool) {
    logEvent('tool_unknown', { tool_name: call.name });
    return { ok: false, reason: `Unknown tool: ${call.name}` };
  }
  return executeWithEntry(tool, call.arguments, options);
};

const executeWithEntry = async (
  tool: AnyToolEntry,
  rawArgs: Readonly<Record<string, unknown>>,
  _options: ExecuteOptions,
): Promise<ToolResult> => {
  const start = Date.now();
  try {
    const parsed = tool.parseParams(rawArgs as never);
    if (!parsed.ok) {
      logEvent('tool_invalid_input', {
        tool_name: tool.name,
        error_code: parsed.error.code,
      });
      return { ok: false, reason: `Invalid input: ${parsed.error.message}` };
    }
    const result = await (tool.execute as (p: unknown) => Promise<{
      ok: boolean;
      value?: unknown;
      error?: NexusError;
    }>)(parsed.value);
    const latency = Date.now() - start;
    if (result.ok) {
      logEvent('tool_executed', { tool_name: tool.name, latency_ms: latency });
      return { ok: true, content: JSON.stringify(result.value ?? null) };
    }
    logEvent('tool_failed', {
      tool_name: tool.name,
      latency_ms: latency,
      error_code: result.error?.code ?? 'UNKNOWN',
    });
    const reason = result.error ? reasonForError(result.error) : 'unknown error';
    return { ok: false, reason };
  } catch (caught) {
    logError('tool_exception', { tool_name: tool.name });
    return { ok: false, reason: `Error: ${reasonForError(caught)}` };
  }
};
