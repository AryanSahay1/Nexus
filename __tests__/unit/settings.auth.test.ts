/**
 * Unit tests for src/store/settingsStore.ts and src/store/authStore.ts.
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
jest.mock('expo-sqlite', () => ({ __esModule: true, openDatabaseAsync: async () => null }));

// eslint-disable-next-line import/first
import { __resetForTests as resetDb, __setDatabaseForTests, type NexusDatabase } from '../../src/db/database';
// eslint-disable-next-line import/first
import {
  __resetForTests as resetSettings,
  createSettingsStore,
  detectActiveProfile,
} from '../../src/store/settingsStore';
// eslint-disable-next-line import/first
import { createAuthStore } from '../../src/store/authStore';
// eslint-disable-next-line import/first
import { createVaultStore } from '../../src/store/vaultStore';
// eslint-disable-next-line import/first
import * as oauthService from '../../src/services/oauthService';
// eslint-disable-next-line import/first
import { PROVIDER_PROFILES, SETTINGS_KEYS } from '../../src/types/settings';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
  __store: Map<string, string>;
};

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
      return { lastInsertRowId: 0, changes: 0 };
    },
  };
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  resetDb();
  resetSettings();
  __setDatabaseForTests(buildFakeDb());
});

// ── settingsStore -----------------------------------------------------------

describe('settingsStore', () => {
  it('hydrates with the documented defaults when no rows exist', async () => {
    const store = createSettingsStore();
    const r = await store.getState().hydrateFromDb();
    expect(r.ok).toBe(true);
    expect(store.getState().baseUrl).toBe('https://api.openai.com/v1');
    expect(store.getState().model).toBe('gpt-4o-mini');
    expect(store.getState().temperature).toBe(0.7);
    expect(store.getState().hapticsEnabled).toBe(true);
    expect(store.getState().streamingEnabled).toBe(false);
    expect(store.getState().defaultCountryCode).toBeNull();
  });

  it('hydration loads previously stored values from preferences', async () => {
    const store = createSettingsStore();
    await store.getState().setBaseUrl('https://api.groq.com/openai/v1');
    await store.getState().setModel('llama3-8b-8192');
    await store.getState().setTemperature(0.4);
    await store.getState().setHapticsEnabled(false);
    await store.getState().setStreamingEnabled(true);
    await store.getState().setDefaultCountryCode('+91');

    const fresh = createSettingsStore();
    await fresh.getState().hydrateFromDb();
    expect(fresh.getState().baseUrl).toBe('https://api.groq.com/openai/v1');
    expect(fresh.getState().model).toBe('llama3-8b-8192');
    expect(fresh.getState().temperature).toBeCloseTo(0.4);
    expect(fresh.getState().hapticsEnabled).toBe(false);
    expect(fresh.getState().streamingEnabled).toBe(true);
    expect(fresh.getState().defaultCountryCode).toBe('+91');
  });

  it('clamps temperature into [0, 2] inclusive', async () => {
    const store = createSettingsStore();
    await store.getState().setTemperature(5);
    expect(store.getState().temperature).toBe(2);
    await store.getState().setTemperature(-3);
    expect(store.getState().temperature).toBe(0);
  });

  it('setDefaultCountryCode(null) deletes the row', async () => {
    const store = createSettingsStore();
    await store.getState().setDefaultCountryCode('+91');
    expect(store.getState().defaultCountryCode).toBe('+91');
    await store.getState().setDefaultCountryCode(null);
    expect(store.getState().defaultCountryCode).toBeNull();
  });

  it('applyProviderProfile(openai) writes the canonical baseUrl + model', async () => {
    const store = createSettingsStore();
    const openai = PROVIDER_PROFILES.find((p) => p.id === 'openai');
    if (!openai) throw new Error('openai profile missing');
    await store.getState().applyProviderProfile(openai);
    expect(store.getState().baseUrl).toBe(openai.baseUrl);
    expect(store.getState().model).toBe(openai.defaultModel);
  });

  it('applyProviderProfile(custom) is a no-op so the user can edit fields', async () => {
    const store = createSettingsStore();
    const before = { baseUrl: store.getState().baseUrl, model: store.getState().model };
    const custom = PROVIDER_PROFILES.find((p) => p.id === 'custom');
    if (!custom) throw new Error('custom profile missing');
    await store.getState().applyProviderProfile(custom);
    expect(store.getState().baseUrl).toBe(before.baseUrl);
    expect(store.getState().model).toBe(before.model);
  });

  it('setOpenAiApiKey writes through to SecureStore via tokenService', async () => {
    const store = createSettingsStore();
    const r = await store.getState().setOpenAiApiKey('sk-test-12345678901234567890');
    expect(r.ok).toBe(true);
    expect(SecureStore.__store.get('nexus_openai_apiKey')).toBe('sk-test-12345678901234567890');
  });

  it('clearOpenAiApiKey removes the SecureStore entry', async () => {
    const store = createSettingsStore();
    await store.getState().setOpenAiApiKey('sk-test-12345678901234567890');
    await store.getState().clearOpenAiApiKey();
    expect(SecureStore.__store.has('nexus_openai_apiKey')).toBe(false);
  });

  it('canonical setting keys are stable', () => {
    expect(SETTINGS_KEYS.AI_BASE_URL).toBe('ai_base_url');
    expect(SETTINGS_KEYS.AI_MODEL).toBe('ai_model');
    expect(SETTINGS_KEYS.AI_TEMPERATURE).toBe('ai_temperature');
    expect(SETTINGS_KEYS.HAPTICS_ENABLED).toBe('haptics_enabled');
    expect(SETTINGS_KEYS.STREAMING_ENABLED).toBe('streaming_enabled');
    expect(SETTINGS_KEYS.DEFAULT_COUNTRY_CODE).toBe('default_country_code');
  });

  it('detectActiveProfile recognises documented base URLs', () => {
    expect(detectActiveProfile('https://api.openai.com/v1')).toBe('openai');
    expect(detectActiveProfile('https://api.groq.com/openai/v1')).toBe('groq');
    expect(detectActiveProfile('http://localhost:11434/v1')).toBe('custom');
  });
});

// ── authStore --------------------------------------------------------------

describe('authStore', () => {
  it('connectGoogle calls oauthService.connect and marks vault connected on success', async () => {
    const vault = createVaultStore();
    const auth = createAuthStore({ getVaultStore: () => vault });
    const spy = jest
      .spyOn(oauthService, 'connect')
      .mockResolvedValueOnce({ ok: true, value: { email: 'alice@example.com' } });
    try {
      const r = await auth.getState().connectGoogle('cid');
      expect(r.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith('google', 'cid');
      expect(vault.getState().snapshot.google.status).toBe('connected');
      expect(vault.getState().snapshot.google.userEmail).toBe('alice@example.com');
    } finally {
      spy.mockRestore();
    }
  });

  it('connectGoogle propagates an oauth Err and leaves vault state untouched', async () => {
    const vault = createVaultStore();
    const auth = createAuthStore({ getVaultStore: () => vault });
    const spy = jest.spyOn(oauthService, 'connect').mockResolvedValueOnce({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: 'no', isRetryable: true } as never,
    });
    try {
      const r = await auth.getState().connectGoogle('cid');
      expect(r.ok).toBe(false);
      expect(vault.getState().snapshot.google.status).toBe('disconnected');
    } finally {
      spy.mockRestore();
    }
  });

  it('disconnectGoogle calls oauthService.disconnect and flips vault state', async () => {
    const vault = createVaultStore();
    vault.getState().markConnected('google', 'a@b.com');
    const auth = createAuthStore({ getVaultStore: () => vault });
    const spy = jest.spyOn(oauthService, 'disconnect').mockResolvedValueOnce({ ok: true, value: undefined });
    try {
      const r = await auth.getState().disconnectGoogle();
      expect(r.ok).toBe(true);
      expect(vault.getState().snapshot.google.status).toBe('disconnected');
    } finally {
      spy.mockRestore();
    }
  });

  it('checkConnection delegates to vaultStore.hydrate', async () => {
    const vault = createVaultStore();
    const auth = createAuthStore({ getVaultStore: () => vault });
    const spy = jest.spyOn(vault.getState(), 'hydrate').mockResolvedValueOnce({ ok: true, value: undefined });
    const r = await auth.getState().checkConnection();
    expect(r.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});
