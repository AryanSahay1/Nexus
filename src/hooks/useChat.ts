/**
 * useChat — composes chatStore + useAgentLoop + useConfirmation into a
 * single API the Chat screen can consume without touching any of the
 * underlying primitives directly.
 *
 * Per LAW 9: components never call services; they go through this hook.
 *
 * The hook also exposes a typed "compose-pending" state (separate from
 * the agent's pendingAction) for the Compose screen to surface a
 * destructive-action confirmation UI distinct from the in-thread
 * ConfirmationSheet.
 */

import { useCallback } from 'react';
import { useStore } from 'zustand';

import { useAgentLoop } from './useAgentLoop';
import { useConfirmation } from './useConfirmation';
import { getChatStore } from '../store/chatStore';
import { type AgentStatus, type Message, type PendingAction } from '../types/agent';
import { type NexusError, type Result } from '../types/auth';

export interface UseChatApi {
  readonly messages: readonly Message[];
  readonly agentStatus: AgentStatus;
  readonly currentToolName: string | null;
  readonly pendingAction: PendingAction | null;
  readonly isAgentBusy: boolean;
  /** Send a user message and run the agent loop. */
  readonly send: (text: string) => Promise<Result<{ status: string }, NexusError>>;
  /** Confirm the destructive action currently pending. */
  readonly confirm: () => void;
  /** Cancel the destructive action currently pending. */
  readonly cancel: () => void;
  /** Wipe local chat history (in-memory + SQLite). */
  readonly clear: () => Promise<Result<void, NexusError>>;
}

export const useChat = (): UseChatApi => {
  const messages = useStore(getChatStore(), (s) => s.messages);
  const agentStatus = useStore(getChatStore(), (s) => s.agentStatus);
  const currentToolName = useStore(getChatStore(), (s) => s.currentToolName);
  const pendingAction = useStore(getChatStore(), (s) => s.pendingAction);

  const confirmation = useConfirmation();
  const { send, isAgentBusy } = useAgentLoop(confirmation.awaitConfirmation);

  const clear = useCallback(
    async () => getChatStore().getState().clearHistory(),
    [],
  );

  return {
    messages,
    agentStatus,
    currentToolName,
    pendingAction,
    isAgentBusy,
    send,
    confirm: confirmation.confirm,
    cancel: confirmation.cancel,
    clear,
  };
};
