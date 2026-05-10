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

import * as chatHistoryRepo from '../db/chatHistoryRepo';
import { type AgentStatus, type Message, type PendingAction } from '../types/agent';
import { type NexusError, type Result } from '../types/auth';
import { logEvent, logError } from '../utils/logger';

interface ChatStateData {
  readonly messages: readonly Message[];
  readonly agentStatus: AgentStatus;
  readonly currentToolName: string | null;
  readonly pendingAction: PendingAction | null;
  readonly hydrating: boolean;
}

interface ChatActions {
  appendMessage: (msg: Message) => void;
  appendMessages: (msgs: readonly Message[]) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setCurrentTool: (toolName: string | null) => void;
  setPendingAction: (action: PendingAction | null) => void;
  clearHistory: () => Promise<Result<void, NexusError>>;
  /**
   * Boot-time loader: pulls every chat_history row out of SQLite and
   * primes the in-memory message buffer. Called by the BootSequencer's
   * `chat_history_hydrate` step.
   */
  hydrateFromDb: () => Promise<Result<void, NexusError>>;
}

export type ChatState = ChatStateData & ChatActions;

const initial = (): ChatStateData => ({
  messages: [],
  agentStatus: 'idle',
  currentToolName: null,
  pendingAction: null,
  hydrating: false,
});

/**
 * Persist a single message to SQLite. Errors are logged but never
 * thrown so a database hiccup cannot derail the agent loop. The
 * in-memory state is the primary source of truth during a session.
 */
const persistOne = (msg: Message): void => {
  void chatHistoryRepo.append(msg).then((result) => {
    if (!result.ok) {
      logError('chat_persist_failed', { error_code: result.error.code });
    }
  });
};

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
      persistOne(msg);
    },
    appendMessages: (msgs) => {
      if (msgs.length === 0) return;
      set((s) => ({ messages: [...s.messages, ...msgs] }));
      // Bulk write — single round-trip per message but in one promise.
      void chatHistoryRepo.appendMany(msgs).then((result) => {
        if (!result.ok) {
          logError('chat_persist_bulk_failed', {
            error_code: result.error.code,
          });
        }
      });
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
    clearHistory: async () => {
      set(initial());
      logEvent('chat_history_cleared', {});
      const result = await chatHistoryRepo.clear();
      if (!result.ok) {
        logError('chat_history_clear_failed', {
          error_code: result.error.code,
        });
      }
      return result;
    },
    hydrateFromDb: async () => {
      set({ hydrating: true });
      // Cap to most recent 200 messages so a chat that has accumulated
      // hundreds of turns over weeks does not slow the boot.
      const result = await chatHistoryRepo.listRecent(200);
      if (!result.ok) {
        set({ hydrating: false });
        return result;
      }
      set({ messages: result.value, hydrating: false });
      return { ok: true, value: undefined };
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
