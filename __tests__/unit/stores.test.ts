/**
 * Unit tests for the three Zustand vanilla stores.
 *
 * Stores are pure state logic — every test runs against a fresh
 * `createXStore()` instance, never the singleton, so order doesn't matter.
 */

import * as SecureStoreReal from 'expo-secure-store';

import { createChatStore, isAllowedTransition } from '../../src/store/chatStore';
import {
  createVaultStore,
  hasAnyConnection,
  isOpenAiConfigured,
} from '../../src/store/vaultStore';
import { createPreferencesStore } from '../../src/store/preferencesStore';
import { setToken } from '../../src/services/tokenService';
import {
  __resetForTests as resetDb,
  __setDatabaseForTests,
  type NexusDatabase,
} from '../../src/db/database';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
    __store: store,
  };
});

jest.mock('expo-sqlite/next', () => ({
  __esModule: true,
  openDatabaseAsync: async () => {
    throw new Error('stores tests inject db directly');
  },
}));
jest.mock('expo-sqlite', () => ({ __esModule: true }));

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  resetDb();
});

// ── chatStore -------------------------------------------------------------

describe('chatStore — state machine', () => {
  it('starts idle with empty history', () => {
    const s = createChatStore().getState();
    expect(s.agentStatus).toBe('idle');
    expect(s.messages).toEqual([]);
    expect(s.currentToolName).toBeNull();
    expect(s.pendingAction).toBeNull();
  });

  it('appendMessage and appendMessages preserve order', () => {
    const store = createChatStore();
    store.getState().appendMessage({ role: 'user', content: 'hello' });
    store.getState().appendMessages([
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'how are you?' },
    ]);
    expect(store.getState().messages.map((m) => m.content)).toEqual([
      'hello',
      'hi there',
      'how are you?',
    ]);
  });

  it('setAgentStatus follows the documented transitions', () => {
    const store = createChatStore();
    store.getState().setAgentStatus('processing_intent');
    expect(store.getState().agentStatus).toBe('processing_intent');
    store.getState().setAgentStatus('executing_tool');
    expect(store.getState().agentStatus).toBe('executing_tool');
    store.getState().setAgentStatus('requires_action');
    expect(store.getState().agentStatus).toBe('requires_action');
    store.getState().setAgentStatus('executing_tool');
    expect(store.getState().agentStatus).toBe('executing_tool');
    store.getState().setAgentStatus('idle');
    expect(store.getState().agentStatus).toBe('idle');
  });

  it('rejects illegal transitions silently (no throw)', () => {
    const store = createChatStore();
    store.getState().setAgentStatus('requires_action'); // illegal: idle -> requires_action
    expect(store.getState().agentStatus).toBe('idle');
  });

  it('setPendingAction round-trips a PendingAction', () => {
    const store = createChatStore();
    store.getState().setPendingAction({
      toolName: 'gmail_send_email',
      toolCallId: 'call_1',
      parameters: { to: 'a@b.com' },
      displaySummary: 'Send email to a@b.com',
    });
    expect(store.getState().pendingAction?.toolName).toBe('gmail_send_email');
    store.getState().setPendingAction(null);
    expect(store.getState().pendingAction).toBeNull();
  });

  it('clearHistory resets to initial state', () => {
    const store = createChatStore();
    store.getState().appendMessage({ role: 'user', content: 'hi' });
    store.getState().setAgentStatus('processing_intent');
    store.getState().clearHistory();
    expect(store.getState().messages).toEqual([]);
    expect(store.getState().agentStatus).toBe('idle');
  });
});

describe('isAllowedTransition', () => {
  it('matches the documented transition table', () => {
    expect(isAllowedTransition('idle', 'processing_intent')).toBe(true);
    expect(isAllowedTransition('idle', 'requires_action')).toBe(false);
    expect(isAllowedTransition('processing_intent', 'executing_tool')).toBe(true);
    expect(isAllowedTransition('executing_tool', 'requires_action')).toBe(true);
    expect(isAllowedTransition('requires_action', 'idle')).toBe(true);
    expect(isAllowedTransition('requires_action', 'requires_action')).toBe(true);
  });
});

// ── vaultStore ------------------------------------------------------------

describe('vaultStore', () => {
  it('hydrate populates the snapshot from tokenService', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345678901234567890');
    const store = createVaultStore();
    const result = await store.getState().hydrate();
    expect(result.ok).toBe(true);
    expect(store.getState().snapshot.openai.status).toBe('connected');
    expect(store.getState().snapshot.google.status).toBe('disconnected');
  });

  it('markConnected updates the snapshot for a single provider', () => {
    const store = createVaultStore();
    store.getState().markConnected('google', 'alice@example.com');
    expect(store.getState().snapshot.google.status).toBe('connected');
    expect(store.getState().snapshot.google.userEmail).toBe('alice@example.com');
    expect(store.getState().snapshot.openai.status).toBe('disconnected');
  });

  it('markDisconnected reverts to the empty connection shape', () => {
    const store = createVaultStore();
    store.getState().markConnected('google', 'a@b.com');
    store.getState().markDisconnected('google');
    expect(store.getState().snapshot.google.status).toBe('disconnected');
    expect(store.getState().snapshot.google.userEmail).toBeNull();
  });

  it('hasAnyConnection / isOpenAiConfigured selectors return correct booleans', () => {
    const store = createVaultStore();
    expect(hasAnyConnection(store.getState())).toBe(false);
    expect(isOpenAiConfigured(store.getState())).toBe(false);
    store.getState().markConnected('openai', null);
    expect(hasAnyConnection(store.getState())).toBe(true);
    expect(isOpenAiConfigured(store.getState())).toBe(true);
  });
});

// ── preferencesStore ------------------------------------------------------

const buildFakeDb = (): NexusDatabase => {
  interface Row {
    id: number;
    key: string;
    value: string;
    category: string;
    created_at: number;
    updated_at: number;
  }
  const rows: Row[] = [];
  let nextId = 1;
  return {
    execAsync: async () => {},
    closeAsync: async () => {},
    getFirstAsync: async <T = unknown>(_sql: string, ...args: readonly unknown[]) => {
      if (_sql.includes('FROM user_preferences WHERE key')) {
        const k = args[0];
        const found = rows.find((r) => r.key === k);
        return (found ?? null) as T | null;
      }
      return null;
    },
    getAllAsync: async <T = unknown>() => rows.slice() as unknown as readonly T[],
    runAsync: async (sql: string, ...args: readonly unknown[]) => {
      const trimmed = sql.replace(/\s+/g, ' ').trim();
      if (trimmed.startsWith('INSERT INTO user_preferences')) {
        const [key, value, category, createdAt, updatedAt] = args as [
          string,
          string,
          string,
          number,
          number,
        ];
        const existing = rows.find((r) => r.key === key);
        if (existing) {
          existing.value = value;
          existing.updated_at = updatedAt;
        } else {
          rows.push({ id: nextId, key, value, category, created_at: createdAt, updated_at: updatedAt });
          nextId += 1;
        }
        return { lastInsertRowId: nextId - 1, changes: 1 };
      }
      if (trimmed.startsWith('DELETE FROM user_preferences WHERE key')) {
        const k = args[0];
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const r = rows[i];
          if (r !== undefined && r.key === k) rows.splice(i, 1);
        }
        return { lastInsertRowId: 0, changes: 1 };
      }
      if (trimmed.startsWith('DELETE FROM user_preferences')) {
        const before = rows.length;
        rows.length = 0;
        return { lastInsertRowId: 0, changes: before };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
  };
};

describe('preferencesStore', () => {
  beforeEach(() => {
    __setDatabaseForTests(buildFakeDb());
  });

  it('hydrateFromDb populates entries and the flat snapshot', async () => {
    const store = createPreferencesStore();
    const result = await store.getState().hydrateFromDb();
    expect(result.ok).toBe(true);
    expect(store.getState().entries).toEqual([]);
    expect(store.getState().snapshot).toEqual({});
  });

  it('set inserts and updates the snapshot in lockstep with the entries list', async () => {
    const store = createPreferencesStore();
    await store.getState().hydrateFromDb();
    const r1 = await store.getState().set('email_tone', 'professional', 'communication');
    expect(r1.ok).toBe(true);
    expect(store.getState().snapshot.email_tone).toBe('professional');

    const r2 = await store.getState().set('email_tone', 'casual', 'communication');
    expect(r2.ok).toBe(true);
    expect(store.getState().snapshot.email_tone).toBe('casual');
    expect(store.getState().entries).toHaveLength(1);
  });

  it('remove deletes from both the entries list and the snapshot', async () => {
    const store = createPreferencesStore();
    await store.getState().hydrateFromDb();
    await store.getState().set('a', '1', 'communication');
    await store.getState().set('b', '2', 'behavior');
    await store.getState().remove('a');
    expect(store.getState().entries.map((e) => e.key)).toEqual(['b']);
    expect(store.getState().snapshot).toEqual({ b: '2' });
  });

  it('clearAll empties both representations', async () => {
    const store = createPreferencesStore();
    await store.getState().hydrateFromDb();
    await store.getState().set('a', '1', 'communication');
    await store.getState().clearAll();
    expect(store.getState().entries).toEqual([]);
    expect(store.getState().snapshot).toEqual({});
  });
});
