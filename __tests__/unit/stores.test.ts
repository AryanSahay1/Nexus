/**
 * Unit tests for the Zustand stores. Each store exposes a small, pure
 * state-machine surface — these tests assert that surface holds.
 */

jest.mock('expo-sqlite', () => ({ __esModule: true }));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (key: string, value: string) => store.set(key, value)),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
  };
});

import { useChatStore } from '../../src/store/chatStore';
import { useUiStore } from '../../src/store/uiStore';
import { useVaultStore } from '../../src/store/vaultStore';

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('chatStore', () => {
  it('appendUser flips status to thinking and assigns a unique id', () => {
    const id1 = useChatStore.getState().appendUser('hi');
    const id2 = useChatStore.getState().appendUser('again');
    const state = useChatStore.getState();
    expect(id1).not.toBe(id2);
    expect(state.messages).toHaveLength(2);
    expect(state.status).toBe('thinking');
    expect(state.errorMessage).toBeNull();
  });

  it('appendAssistant flips status back to idle', () => {
    useChatStore.getState().appendUser('hi');
    useChatStore.getState().appendAssistant('hello back');
    expect(useChatStore.getState().status).toBe('idle');
    expect(useChatStore.getState().messages).toHaveLength(2);
  });

  it('setError moves status to error and stores the message', () => {
    useChatStore.getState().setError('boom');
    expect(useChatStore.getState().status).toBe('error');
    expect(useChatStore.getState().errorMessage).toBe('boom');
  });

  it('reset clears every observable field', () => {
    useChatStore.getState().appendUser('x');
    useChatStore.getState().setError('y');
    useChatStore.getState().reset();
    const s = useChatStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.status).toBe('idle');
    expect(s.errorMessage).toBeNull();
    expect(s.nextId).toBe(1);
  });
});

describe('uiStore', () => {
  it('request stores the pending confirmation, resolve clears it', () => {
    const noop = (): void => undefined;
    useUiStore.getState().request({
      id: 'c-1',
      title: 'Disconnect Google?',
      body: 'This will revoke your tokens.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Keep it',
      destructive: true,
      onConfirm: noop,
      onCancel: noop,
    });
    expect(useUiStore.getState().pendingConfirmation?.id).toBe('c-1');
    useUiStore.getState().resolve();
    expect(useUiStore.getState().pendingConfirmation).toBeNull();
  });
});

describe('vaultStore', () => {
  it('refresh populates the snapshot with the disconnected baseline when nothing is stored', async () => {
    await useVaultStore.getState().refresh();
    const snapshot = useVaultStore.getState().snapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot?.google.status).toBe('disconnected');
    expect(snapshot?.openai.status).toBe('disconnected');
    expect(snapshot?.whatsapp.status).toBe('disconnected');
    expect(useVaultStore.getState().isRefreshing).toBe(false);
  });
});
