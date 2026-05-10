/**
 * Unit tests for src/utils/crashSentinel.ts.
 *
 * The sentinel uses SecureStore to persist two timestamps. Tests run
 * against the standard expo-secure-store mock used elsewhere in the suite.
 */

import * as SecureStoreReal from 'expo-secure-store';

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

// eslint-disable-next-line import/first
import {
  __internal,
  clearSentinel,
  markAttempt,
  markOk,
  readSentinel,
} from '../../src/utils/crashSentinel';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
  __store: Map<string, string>;
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
});

describe('crashSentinel', () => {
  it('first launch: no attempt, no ok → previousLaunchCrashed=false', async () => {
    const r = await readSentinel();
    expect(r.attemptIso).toBeNull();
    expect(r.okIso).toBeNull();
    expect(r.previousLaunchCrashed).toBe(false);
  });

  it('happy path: attempt then ok → no crash', async () => {
    await markAttempt();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await markOk();
    const r = await readSentinel();
    expect(r.attemptIso).not.toBeNull();
    expect(r.okIso).not.toBeNull();
    expect(r.previousLaunchCrashed).toBe(false);
  });

  it('crash signal: attempt with no subsequent ok → previousLaunchCrashed=true', async () => {
    await markAttempt();
    const r = await readSentinel();
    expect(r.attemptIso).not.toBeNull();
    expect(r.okIso).toBeNull();
    expect(r.previousLaunchCrashed).toBe(true);
  });

  it('newer attempt than ok (re-crashed after a previous success) → flagged as crash', async () => {
    await markOk(); // simulate prior successful boot
    await new Promise((resolve) => setTimeout(resolve, 5));
    await markAttempt(); // simulate new attempt that didn't finish
    const r = await readSentinel();
    expect(r.previousLaunchCrashed).toBe(true);
  });

  it('newer ok than attempt → no crash', async () => {
    await markAttempt();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await markOk();
    const r = await readSentinel();
    expect(r.previousLaunchCrashed).toBe(false);
  });

  it('clearSentinel deletes both keys', async () => {
    await markAttempt();
    await markOk();
    expect(SecureStore.__store.size).toBe(2);
    const r = await clearSentinel();
    expect(r.ok).toBe(true);
    expect(SecureStore.__store.size).toBe(0);
  });

  it('readSentinel never throws even when SecureStore reads reject', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore busy'));
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore busy'));
    const r = await readSentinel();
    expect(r.attemptIso).toBeNull();
    expect(r.okIso).toBeNull();
    expect(r.previousLaunchCrashed).toBe(false);
  });

  it('markAttempt / markOk swallow SecureStore write failures silently', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore full'));
    await expect(markAttempt()).resolves.toBeUndefined();
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore full'));
    await expect(markOk()).resolves.toBeUndefined();
  });

  it('exports stable SecureStore key names for cross-version compatibility', () => {
    expect(__internal.KEY_ATTEMPT).toBe('nexus_last_boot_attempt');
    expect(__internal.KEY_OK).toBe('nexus_last_boot_ok');
  });
});
