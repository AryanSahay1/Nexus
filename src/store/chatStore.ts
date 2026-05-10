/**
 * Chat store — Zustand state for the conversation surface.
 *
 * Holds:
 *   - the running list of UI messages (user + assistant)
 *   - the agent's run state (idle | thinking | error)
 *   - the latest error message, if any
 *
 * Tool messages are NOT mirrored here — they're orchestration noise. The
 * agent loop persists user + assistant turns to SQLite via chatHistoryRepo;
 * this store is the volatile, per-session view layered on top.
 */

import { create } from 'zustand';

export type AgentStatus = 'idle' | 'thinking' | 'error';

export interface ChatUiMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly createdAt: number;
}

export interface ChatStore {
  readonly messages: readonly ChatUiMessage[];
  readonly status: AgentStatus;
  readonly errorMessage: string | null;
  readonly nextId: number;
  appendUser: (text: string) => string;
  appendAssistant: (text: string) => void;
  setThinking: () => void;
  setIdle: () => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  status: 'idle',
  errorMessage: null,
  nextId: 1,
  appendUser: (text) => {
    const id = `u-${get().nextId}`;
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: 'user', text, createdAt: Date.now() },
      ],
      nextId: s.nextId + 1,
      status: 'thinking',
      errorMessage: null,
    }));
    return id;
  },
  appendAssistant: (text) => {
    const id = `a-${get().nextId}`;
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: 'assistant', text, createdAt: Date.now() },
      ],
      nextId: s.nextId + 1,
      status: 'idle',
    }));
  },
  setThinking: () => set({ status: 'thinking', errorMessage: null }),
  setIdle: () => set({ status: 'idle' }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  reset: () => set({ messages: [], status: 'idle', errorMessage: null, nextId: 1 }),
}));
