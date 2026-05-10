/**
 * useAgentLoop — React adapter that turns a UI submit into an
 * agentLoop.runAgentTurn() invocation with all dependencies wired.
 *
 * The hook itself does not own state. Components call `send(text)` and
 * subscribe separately to chatStore for messages / status / pendingAction.
 * The hook also exposes `isAgentBusy` so the input bar can disable
 * itself while a turn is in flight (closes Cycle Two regression R-14).
 */

import { useCallback } from 'react';
import { useStore } from 'zustand';

import * as agentLoop from '../agent/agentLoop';
import { type ToolCall, type ToolResult } from '../types/agent';
import { runAgentTurn } from '../agent/agentLoop';
import { execute as executeTool } from '../agent/toolExecutor';
import * as openaiService from '../services/openaiService';
import { type Provider, type Result, type NexusError } from '../types/auth';
import { type OpenAiMessage } from '../types/tools';
import { getChatStore } from '../store/chatStore';
import { getPreferencesStore } from '../store/preferencesStore';
import { getSettingsStore } from '../store/settingsStore';
import { getVaultStore } from '../store/vaultStore';

const connectedProviders = (): readonly Provider[] => {
  const snap = getVaultStore().getState().snapshot;
  const out: Provider[] = [];
  for (const p of ['google', 'openai', 'whatsapp'] as const) {
    if (snap[p].status === 'connected') out.push(p);
  }
  return out;
};

const inferTimezone = (): string => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
};

interface UseAgentLoopApi {
  readonly send: (userMessage: string) => Promise<Result<{ status: string }, NexusError>>;
  readonly isAgentBusy: boolean;
}

/**
 * Hook factory. Optionally accepts an `awaitConfirmation` injected from
 * the parent screen (the ConfirmationSheet's hook). When omitted it
 * falls back to a noop that auto-cancels — useful for screens that
 * never present destructive actions.
 */
export const useAgentLoop = (
  awaitConfirmation: () => Promise<{ confirmed: boolean }>,
): UseAgentLoopApi => {
  const agentStatus = useStore(getChatStore(), (s) => s.agentStatus);
  const isAgentBusy = agentStatus !== 'idle';

  const send = useCallback(
    async (userMessage: string): Promise<Result<{ status: string }, NexusError>> => {
      const chat = getChatStore();
      const settings = getSettingsStore().getState();

      const deps: agentLoop.AgentDeps = {
        chat: (messages: readonly OpenAiMessage[], tools: readonly unknown[]) =>
          openaiService.chatCompletion({
            model: settings.model,
            messages,
            tools,
            toolChoice: 'auto',
            temperature: settings.temperature,
          }),
        executeTool: (call: ToolCall): Promise<ToolResult> => executeTool(call),
        getHistory: () => chat.getState().messages,
        appendMessage: (m) => chat.getState().appendMessage(m),
        setStatus: (s) => chat.getState().setAgentStatus(s),
        setCurrentTool: (n) => chat.getState().setCurrentTool(n),
        setPendingAction: (a) => chat.getState().setPendingAction(a),
        awaitConfirmation,
        getPreferences: () => getPreferencesStore().getState().snapshot,
        getConnectedProviders: connectedProviders,
        now: () => new Date(),
        timezone: inferTimezone,
      };

      return runAgentTurn(userMessage, deps);
    },
    [awaitConfirmation],
  );

  return { send, isAgentBusy };
};
