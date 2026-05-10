/**
 * Sprint 2 — security boundary and edge-case tests.
 *
 * Scope is constrained to the subsystems that exist today (tokenService,
 * logger, db). Subsystems explicitly deferred (per the governance report):
 *
 *   - apiClient 401-refresh interceptor (file does not exist yet)
 *   - oauthService PKCE flow (file does not exist yet)
 *   - agentLoop confirmation gate (file does not exist yet)
 *   - permission-denial paths for contacts / mic / location (no executors yet)
 *
 * The tests below pin behaviour that today's code MUST exhibit before any
 * higher-level subsystem can rely on it.
 */

import * as SecureStoreReal from 'expo-secure-store';

import {
  __internal,
  deleteAllTokensForProvider,
  getAllConnectedProviders,
  getServiceConnection,
  getToken,
  setOAuthBundle,
  setToken,
} from '../../src/services/tokenService';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
    __store: store,
  };
});

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
  __store: Map<string, string>;
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
});

describe('LAW 1 — SecureStore null handling', () => {
  it('treats a SecureStore null read as TOKEN_NOT_FOUND, never as an empty string', async () => {
    const result = await getToken('google', 'accessToken');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TOKEN_NOT_FOUND');
      expect(result.error.message).not.toContain('null');
    }
  });

  it('aggregated snapshot remains internally consistent when every provider is empty', async () => {
    const snap = await getAllConnectedProviders();
    expect(snap.ok).toBe(true);
    if (snap.ok) {
      for (const provider of __internal.ALL_PROVIDERS) {
        const conn = snap.value[provider];
        expect(conn.status).toBe('disconnected');
        expect(conn.userEmail).toBeNull();
        expect(conn.tokenExpiresAt).toBeNull();
      }
    }
  });
});

describe('LAW 5 — atomic OAuth bundle rotation under partial failure', () => {
  it('a write failure on the FIRST field leaves the provider untouched', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('keychain busy');
    });
    const result = await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    expect(SecureStore.__store.size).toBe(0);
  });

  it('a write failure on the LAST field rolls back every preceding field', async () => {
    let callIndex = 0;
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        callIndex += 1;
        if (callIndex === 4) throw new Error('keychain full');
        SecureStore.__store.set(key, value);
      },
    );
    const result = await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
      userEmail: 'user@example.com',
    });
    expect(result.ok).toBe(false);
    for (const tt of __internal.ALL_TOKEN_TYPES) {
      expect(SecureStore.__store.has(`nexus_google_${tt}`)).toBe(false);
    }
  });

  it('rollback never touches OTHER providers', async () => {
    await setToken('openai', 'apiKey', 'sk-survivor');
    let callIndex = 0;
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        callIndex += 1;
        if (callIndex === 3) throw new Error('keychain busy');
        SecureStore.__store.set(key, value);
      },
    );
    const result = await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    expect(SecureStore.__store.get('nexus_openai_apiKey')).toBe('sk-survivor');
  });

  it('a corrupted (JSON-shaped) field aborts the whole bundle BEFORE any write', async () => {
    const result = await setOAuthBundle('google', {
      accessToken: '{"injected":"blob"}',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.__store.size).toBe(0);
  });
});

describe('SecureStore native failures map to typed Result errors', () => {
  it('a getItemAsync rejection becomes SECURE_STORE_UNAVAILABLE with isRetryable=true', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    const result = await getToken('google', 'accessToken');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SECURE_STORE_UNAVAILABLE');
      expect(result.error.isRetryable).toBe(true);
    }
  });

  it('a deleteItemAsync rejection becomes TOKEN_DELETE_FAILED but provider rollback continues for other keys', async () => {
    await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    let calls = 0;
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      calls += 1;
      if (calls === 2) throw new Error('locked');
      SecureStore.__store.delete(key);
    });
    const result = await deleteAllTokensForProvider('google');
    expect(result.ok).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(__internal.ALL_TOKEN_TYPES.length);
  });
});

describe('LAW 2 — defense-in-depth scrubbing on the rotation path', () => {
  it('a SecureStore failure on the rotation path NEVER lets the raw token reach the console', async () => {
    const messages: string[] = [];
    const log = jest.spyOn(console, 'log').mockImplementation((m: unknown) => {
      messages.push(String(m));
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation((m: unknown) => {
      messages.push(String(m));
    });
    try {
      (SecureStore.setItemAsync as jest.Mock).mockImplementationOnce(async () => {
        throw new Error('keychain busy');
      });
      const verySensitive = 'sk-very-sensitive-token-value-9876543210ABC';
      const result = await setToken('openai', 'apiKey', verySensitive);
      expect(result.ok).toBe(false);
      const joined = messages.join('\n');
      expect(joined).not.toContain(verySensitive);
    } finally {
      log.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe('Connection-state derivation under malformed expiry', () => {
  it('treats a non-ISO tokenExpiry as null rather than throwing', async () => {
    SecureStore.__store.set('nexus_google_accessToken', 'tok');
    SecureStore.__store.set('nexus_google_tokenExpiry', 'not-a-real-date');
    const conn = await getServiceConnection('google');
    expect(conn.ok).toBe(true);
    if (conn.ok) {
      expect(conn.value.status).toBe('connected');
      expect(conn.value.tokenExpiresAt).toBeNull();
    }
  });

  it('correctly parses Z-suffixed and offset-suffixed ISO strings consistently', async () => {
    SecureStore.__store.set('nexus_google_accessToken', 'tok');
    SecureStore.__store.set('nexus_google_tokenExpiry', '2030-06-15T10:30:00+05:30');
    const conn = await getServiceConnection('google');
    expect(conn.ok).toBe(true);
    if (conn.ok) {
      expect(typeof conn.value.tokenExpiresAt).toBe('number');
      expect(conn.value.tokenExpiresAt).toBe(Date.parse('2030-06-15T10:30:00+05:30'));
    }
  });
});
