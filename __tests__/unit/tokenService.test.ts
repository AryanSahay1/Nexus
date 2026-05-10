/**
 * Unit tests for src/services/tokenService.ts.
 *
 * The expo-secure-store native module is fully mocked. These tests verify the
 * service's contract end-to-end: key construction, validation, error mapping,
 * and the OAuth-bundle write helper. They do not exercise the real Keychain.
 */

import * as SecureStoreReal from 'expo-secure-store';

import { NexusError, type Provider, type TokenType } from '../../src/types/auth';
import {
  __internal,
  buildKey,
  deleteAllTokensForProvider,
  deleteToken,
  getAllConnectedProviders,
  getServiceConnection,
  getToken,
  isProviderConnected,
  setOAuthBundle,
  setToken,
  wipeAllCredentials,
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

describe('buildKey', () => {
  it('produces the canonical pattern nexus_<provider>_<tokenType>', () => {
    expect(buildKey('google', 'accessToken')).toBe('nexus_google_accessToken');
    expect(buildKey('whatsapp', 'apiKey')).toBe('nexus_whatsapp_apiKey');
    expect(buildKey('openai', 'refreshToken')).toBe('nexus_openai_refreshToken');
  });

  it('produces a unique key for every (provider, tokenType) tuple', () => {
    const seen = new Set<string>();
    for (const provider of __internal.ALL_PROVIDERS) {
      for (const tokenType of __internal.ALL_TOKEN_TYPES) {
        const key = buildKey(provider, tokenType);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});

describe('validateTokenValue', () => {
  const v = __internal.validateTokenValue;

  it('rejects non-strings', () => {
    expect(v(123).ok).toBe(false);
    expect(v(null).ok).toBe(false);
    expect(v(undefined).ok).toBe(false);
    expect(v({ accessToken: 'abc' }).ok).toBe(false);
  });

  it('rejects empty and whitespace-only strings', () => {
    expect(v('').ok).toBe(false);
    expect(v('   ').ok).toBe(false);
    expect(v('\n\t').ok).toBe(false);
  });

  it('rejects oversized values', () => {
    const oversized = 'a'.repeat(__internal.MAX_TOKEN_LENGTH + 1);
    const result = v(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TOKEN_VALUE');
  });

  it('rejects JSON-object-shaped strings to enforce LAW 5', () => {
    const result = v('{"accessToken":"abc"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/LAW 5/);
  });

  it('rejects JSON-array-shaped strings', () => {
    expect(v('["a","b"]').ok).toBe(false);
  });

  it('accepts a normal opaque token string', () => {
    expect(v('ya29.a0AfH6SMA...').ok).toBe(true);
  });

  it('accepts a JWT-shaped string', () => {
    expect(v('eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.payload.sig').ok).toBe(true);
  });
});

describe('setToken', () => {
  it('stores a valid token under the canonical key', async () => {
    const result = await setToken('google', 'accessToken', 'tok_abc');
    expect(result.ok).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'nexus_google_accessToken',
      'tok_abc',
      expect.objectContaining({ keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }),
    );
  });

  it('returns INVALID_TOKEN_VALUE for empty input and skips the native call', async () => {
    const result = await setToken('google', 'accessToken', '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TOKEN_VALUE');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('returns TOKEN_WRITE_FAILED when SecureStore throws', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain busy'));
    const result = await setToken('google', 'accessToken', 'tok_abc');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NexusError);
      expect(result.error.code).toBe('TOKEN_WRITE_FAILED');
      expect(result.error.isRetryable).toBe(true);
    }
  });

  it('refuses to persist a JSON blob (LAW 5)', async () => {
    const result = await setToken('google', 'accessToken', JSON.stringify({ accessToken: 'x' }));
    expect(result.ok).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('getToken', () => {
  it('round-trips a stored token', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345');
    const result = await getToken('openai', 'apiKey');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('sk-test-12345');
  });

  it('returns TOKEN_NOT_FOUND when the key is absent', async () => {
    const result = await getToken('google', 'refreshToken');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns TOKEN_NOT_FOUND when the stored value is empty string', async () => {
    SecureStore.__store.set('nexus_google_accessToken', '');
    const result = await getToken('google', 'accessToken');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns SECURE_STORE_UNAVAILABLE when the native call throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore boot'));
    const result = await getToken('google', 'accessToken');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SECURE_STORE_UNAVAILABLE');
  });
});

describe('deleteToken', () => {
  it('removes a stored token and is idempotent', async () => {
    await setToken('google', 'accessToken', 'tok_abc');
    expect((await getToken('google', 'accessToken')).ok).toBe(true);

    const first = await deleteToken('google', 'accessToken');
    expect(first.ok).toBe(true);
    expect((await getToken('google', 'accessToken')).ok).toBe(false);

    const second = await deleteToken('google', 'accessToken');
    expect(second.ok).toBe(true);
  });

  it('returns TOKEN_DELETE_FAILED when the native call throws', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    const result = await deleteToken('google', 'accessToken');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_DELETE_FAILED');
  });
});

describe('deleteAllTokensForProvider', () => {
  it('removes every TokenType for the provider while preserving others', async () => {
    await setToken('google', 'accessToken', 'g_access');
    await setToken('google', 'refreshToken', 'g_refresh');
    await setToken('google', 'userEmail', 'user@example.com');
    await setToken('openai', 'apiKey', 'sk-keep-me');

    const result = await deleteAllTokensForProvider('google');
    expect(result.ok).toBe(true);

    expect((await getToken('google', 'accessToken')).ok).toBe(false);
    expect((await getToken('google', 'refreshToken')).ok).toBe(false);
    expect((await getToken('google', 'userEmail')).ok).toBe(false);
    expect((await getToken('openai', 'apiKey')).ok).toBe(true);
  });

  it('surfaces the first underlying error but still attempts every key', async () => {
    await setToken('google', 'accessToken', 'g_access');
    await setToken('google', 'refreshToken', 'g_refresh');
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('boom');
    });

    const result = await deleteAllTokensForProvider('google');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_DELETE_FAILED');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(__internal.ALL_TOKEN_TYPES.length);
  });
});

describe('setOAuthBundle (rotation entry point)', () => {
  it('writes each field as a separate SecureStore key (LAW 5)', async () => {
    const result = await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
      userEmail: 'user@example.com',
      clientId: '1234.apps.googleusercontent.com',
    });
    expect(result.ok).toBe(true);

    expect(SecureStore.__store.get('nexus_google_accessToken')).toBe('g_access');
    expect(SecureStore.__store.get('nexus_google_refreshToken')).toBe('g_refresh');
    expect(SecureStore.__store.get('nexus_google_tokenExpiry')).toBe('2030-01-01T00:00:00.000Z');
    expect(SecureStore.__store.get('nexus_google_userEmail')).toBe('user@example.com');
    expect(SecureStore.__store.get('nexus_google_clientId')).toBe('1234.apps.googleusercontent.com');
  });

  it('skips null / undefined fields without writing', async () => {
    await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: null,
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    expect(SecureStore.__store.has('nexus_google_refreshToken')).toBe(false);
    expect(SecureStore.__store.has('nexus_google_userEmail')).toBe(false);
    expect(SecureStore.__store.get('nexus_google_accessToken')).toBe('g_access');
  });

  it('rotates the access token without leaving the previous value behind', async () => {
    await setOAuthBundle('google', {
      accessToken: 'g_access_old',
      refreshToken: 'g_refresh_v1',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    await setOAuthBundle('google', {
      accessToken: 'g_access_new',
      refreshToken: 'g_refresh_v1',
      accessTokenExpirationDate: '2030-02-01T00:00:00.000Z',
    });
    const accessTokenAfterRotation = await getToken('google', 'accessToken');
    expect(accessTokenAfterRotation.ok).toBe(true);
    if (accessTokenAfterRotation.ok) expect(accessTokenAfterRotation.value).toBe('g_access_new');
    const expiry = await getToken('google', 'tokenExpiry');
    if (expiry.ok) expect(expiry.value).toBe('2030-02-01T00:00:00.000Z');
  });
});

describe('connection snapshots', () => {
  it('reports disconnected when no credential exists', async () => {
    const conn = await getServiceConnection('google');
    expect(conn.ok).toBe(true);
    if (conn.ok) expect(conn.value.status).toBe('disconnected');
    expect(await isProviderConnected('google')).toBe(false);
  });

  it('reports connected with userEmail and parsed expiry', async () => {
    await setOAuthBundle('google', {
      accessToken: 'g_access',
      refreshToken: 'g_refresh',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
      userEmail: 'user@example.com',
    });
    const conn = await getServiceConnection('google');
    expect(conn.ok).toBe(true);
    if (conn.ok) {
      expect(conn.value.status).toBe('connected');
      expect(conn.value.userEmail).toBe('user@example.com');
      expect(conn.value.tokenExpiresAt).toBe(Date.parse('2030-01-01T00:00:00.000Z'));
    }
    expect(await isProviderConnected('google')).toBe(true);
  });

  it('treats apiKey-only providers (e.g. openai) as connected', async () => {
    await setToken('openai', 'apiKey', 'sk-abc');
    expect(await isProviderConnected('openai')).toBe(true);
  });

  it('aggregates all providers for the Vault snapshot', async () => {
    await setToken('openai', 'apiKey', 'sk-abc');
    const snapshot = await getAllConnectedProviders();
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.value.openai.status).toBe('connected');
      expect(snapshot.value.google.status).toBe('disconnected');
      expect(snapshot.value.whatsapp.status).toBe('disconnected');
    }
  });
});

describe('wipeAllCredentials', () => {
  it('removes every credential across every provider', async () => {
    await setToken('openai', 'apiKey', 'sk-abc');
    await setOAuthBundle('google', {
      accessToken: 'g_access',
      accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
    });
    await setToken('whatsapp', 'apiKey', 'wa-xyz');

    const result = await wipeAllCredentials();
    expect(result.ok).toBe(true);

    const providers: readonly Provider[] = ['google', 'whatsapp', 'openai'];
    const types: readonly TokenType[] = [
      'accessToken',
      'refreshToken',
      'apiKey',
      'tokenExpiry',
      'userEmail',
      'clientId',
    ];
    for (const provider of providers) {
      for (const tokenType of types) {
        expect(SecureStore.__store.has(`nexus_${provider}_${tokenType}`)).toBe(false);
      }
    }
  });
});

describe('logging hygiene (LAW 2)', () => {
  it('never includes raw token values in console output', async () => {
    const calls: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((msg: unknown) => {
      calls.push(String(msg));
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      calls.push(String(msg));
    });
    try {
      await setToken('openai', 'apiKey', 'sk-super-secret-value-12345');
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      await deleteToken('openai', 'apiKey');
      const joined = calls.join('\n');
      expect(joined).not.toContain('sk-super-secret-value-12345');
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
