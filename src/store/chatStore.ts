/**
 * Chat store — message history + agent state machine.
 *
 * Owns:
 *   - in-memory `messages` (mirrors / hydrated from `chat_history` SQLite table)
 *   - `agentStatus` finite state machine
 *   - `currentToolName` for the executing-tool badge
 *   - `pendingAction` for the destructive-action confirmation gate
 *
 * Exposed as a Zustand vanilla store so the agent loop, hooks, and
 * components can subscribe via the same API.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';

import { type AgentStatus, type Message, type PendingAction } from '../types/agent';
import { logEvent } from '../utils/logger';

interface ChatStateData {
  readonly messages: readonly Message[];
  readonly agentStatus: AgentStatus;
  readonly currentToolName: string | null;
  readonly pendingAction: PendingAction | null;
}

interface ChatActions {
  appendMessage: (msg: Message) => void;
  appendMessages: (msgs: readonly Message[]) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setCurrentTool: (toolName: string | null) => void;
  setPendingAction: (action: PendingAction | null) => void;
  clearHistory: () => void;
}

export type ChatState = ChatStateData & ChatActions;

const initial = (): ChatStateData => ({
  messages: [],
  agentStatus: 'idle',
  currentToolName: null,
  pendingAction: null,
});

/**
 * State-transition guard. Returns true if the proposed transition is
 * allowed by the engineering directive's documented state machine:
 *
 *   idle               -> processing_intent
 *   processing_intent  -> executing_tool | idle
 *   executing_tool     -> requires_action | idle | processing_intent
 *   requires_action    -> executing_tool | idle
 *
 * Reverse / lateral transitions to `idle` are always allowed (terminal).
 */
const ALLOWED: Readonly<Record<AgentStatus, ReadonlySet<AgentStatus>>> = {
  idle: new Set<AgentStatus>(['processing_intent', 'idle']),
  processing_intent: new Set<AgentStatus>(['executing_tool', 'idle']),
  executing_tool: new Set<AgentStatus>(['requires_action', 'idle', 'processing_intent']),
  requires_action: new Set<AgentStatus>(['executing_tool', 'idle']),
};

export const isAllowedTransition = (from: AgentStatus, to: AgentStatus): boolean => {
  if (from === to) return true;
  return ALLOWED[from].has(to);
};

export const createChatStore = (): StoreApi<ChatState> =>
  createStore<ChatState>((set) => ({
    ...initial(),
    appendMessage: (msg) => {
      set((s) => ({ messages: [...s.messages, msg] }));
    },
    appendMessages: (msgs) => {
      if (msgs.length === 0) return;
      set((s) => ({ messages: [...s.messages, ...msgs] }));
    },
    setAgentStatus: (status) => {
      set((s) => {
        if (!isAllowedTransition(s.agentStatus, status)) {
          // Defensive: log and ignore — agent loop should never propose an
          // illegal transition. We do NOT throw because UI rendering must
          // not be derailed by a state-machine bug (LAW 3).
          logEvent('chat_status_transition_rejected', {
            from: s.agentStatus,
            status,
          });
          return s;
        }
        return { agentStatus: status };
      });
    },
    setCurrentTool: (toolName) => {
      set({ currentToolName: toolName });
    },
    setPendingAction: (action) => {
      set({ pendingAction: action });
    },
    clearHistory: () => {
      set(initial());
      logEvent('chat_history_cleared', {});
    },
  }));

let singleton: StoreApi<ChatState> | null = null;
export const getChatStore = (): StoreApi<ChatState> => {
  if (singleton === null) singleton = createChatStore();
  return singleton;
};

/** Test-only: blow away the singleton between tests. */
export const __resetForTests = (): void => {
  singleton = null;
};
