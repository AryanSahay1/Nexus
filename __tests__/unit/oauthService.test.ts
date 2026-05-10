/**
 * Unit tests for src/services/oauthService.ts.
 *
 * The react-native-app-auth backend is fully stubbed so the test runner
 * does not boot a real native module. Every interaction with the secure
 * enclave goes through the existing tokenService contract.
 */

import * as SecureStoreReal from 'expo-secure-store';

import { NexusError } from '../../src/types/auth';
import {
  __resetForTests,
  buildGoogleConfig,
  connect,
  decodeIdToken,
  disconnect,
  installOAuthBackend,
  refreshAccessToken,
  type AppAuthBackend,
} from '../../src/services/oauthService';
import { getToken, setToken } from '../../src/services/tokenService';

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

const fakeIdTokenFor = (payload: Record<string, unknown>): string => {
  const enc = (s: string): string =>
    Buffer.from(s, 'utf-8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = enc(JSON.stringify(payload));
  return `${header}.${body}.signature_ignored`;
};

beforeEach(() => {
  SecureStore.__reset();
  __resetForTests();
  jest.clearAllMocks();
});

describe('buildGoogleConfig', () => {
  it('produces the canonical Google PKCE config', () => {
    const cfg = buildGoogleConfig('1234.apps.googleusercontent.com');
    expect(cfg.issuer).toBe('https://accounts.google.com');
    expect(cfg.clientId).toBe('1234.apps.googleusercontent.com');
    expect(cfg.redirectUrl).toBe('com.nexus.app:/oauth2redirect/google');
    expect(cfg.scopes).toContain('openid');
    expect(cfg.scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(cfg.scopes).toContain('https://www.googleapis.com/auth/gmail.send');
    expect(cfg.scopes).toContain('https://www.googleapis.com/auth/calendar');
    expect(cfg.additionalParameters).toEqual({ access_type: 'offline', prompt: 'consent' });
  });
});

describe('decodeIdToken', () => {
  it('extracts the email claim from a well-formed id_token', () => {
    const idToken = fakeIdTokenFor({ email: 'alice@example.com', sub: '123' });
    expect(decodeIdToken(idToken)).toEqual({ email: 'alice@example.com' });
  });

  it('returns email=null when the email claim is missing', () => {
    const idToken = fakeIdTokenFor({ sub: '123' });
    expect(decodeIdToken(idToken)).toEqual({ email: null });
  });

  it('returns email=null on a malformed token rather than throwing', () => {
    expect(decodeIdToken('not.a.real.token')).toEqual({ email: null });
    expect(decodeIdToken('')).toEqual({ email: null });
    expect(decodeIdToken('only.two')).toEqual({ email: null });
  });
});

describe('connect (Google PKCE)', () => {
  it('persists every field of the grant atomically and returns the user email', async () => {
    const backend: AppAuthBackend = {
      authorize: jest.fn(async () => ({
        accessToken: 'g_access',
        refreshToken: 'g_refresh',
        accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
        idToken: fakeIdTokenFor({ email: 'alice@example.com' }),
      })),
      refresh: jest.fn(),
    };
    installOAuthBackend(backend);

    const result = await connect('google', '1234.apps.googleusercontent.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe('alice@example.com');

    expect(SecureStore.__store.get('nexus_google_accessToken')).toBe('g_access');
    expect(SecureStore.__store.get('nexus_google_refreshToken')).toBe('g_refresh');
    expect(SecureStore.__store.get('nexus_google_tokenExpiry')).toBe('2030-01-01T00:00:00.000Z');
    expect(SecureStore.__store.get('nexus_google_userEmail')).toBe('alice@example.com');
    expect(SecureStore.__store.get('nexus_google_clientId')).toBe('1234.apps.googleusercontent.com');
  });

  it('returns INVALID_INPUT when called with an empty client id and never invokes authorize', async () => {
    const backend: AppAuthBackend = { authorize: jest.fn(), refresh: jest.fn() };
    installOAuthBackend(backend);
    const result = await connect('google', '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
    expect(backend.authorize).not.toHaveBeenCalled();
  });

  it('returns PROVIDER_ERROR (retryable) when authorize() rejects', async () => {
    const backend: AppAuthBackend = {
      authorize: jest.fn(async () => {
        throw new Error('user cancelled');
      }),
      refresh: jest.fn(),
    };
    installOAuthBackend(backend);
    const result = await connect('google', 'cid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.isRetryable).toBe(true);
    }
    expect(SecureStore.__store.size).toBe(0);
  });

  it('rolls back partial writes when persistence fails inside setOAuthBundle', async () => {
    const backend: AppAuthBackend = {
      authorize: jest.fn(async () => ({
        accessToken: 'g_access',
        refreshToken: 'g_refresh',
        accessTokenExpirationDate: '2030-01-01T00:00:00.000Z',
        idToken: fakeIdTokenFor({ email: 'alice@example.com' }),
      })),
      refresh: jest.fn(),
    };
    installOAuthBackend(backend);

    let writeIndex = 0;
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        writeIndex += 1;
        if (writeIndex === 3) throw new Error('keychain busy');
        SecureStore.__store.set(key, value);
      },
    );

    const result = await connect('google', 'cid');
    expect(result.ok).toBe(false);
    expect(SecureStore.__store.has('nexus_google_accessToken')).toBe(false);
    expect(SecureStore.__store.has('nexus_google_refreshToken')).toBe(false);
  });

  it('returns UNKNOWN when no backend has been installed', async () => {
    const result = await connect('google', 'cid');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN');
  });
});

describe('disconnect', () => {
  it('removes every stored credential for the provider', async () => {
    await setToken('google', 'accessToken', 'g_access');
    await setToken('google', 'refreshToken', 'g_refresh');
    await setToken('google', 'userEmail', 'a@b.com');
    const result = await disconnect('google');
    expect(result.ok).toBe(true);
    expect((await getToken('google', 'accessToken')).ok).toBe(false);
    expect((await getToken('google', 'refreshToken')).ok).toBe(false);
    expect((await getToken('google', 'userEmail')).ok).toBe(false);
  });
});

describe('refreshAccessToken', () => {
  it('rotates accessToken + tokenExpiry and returns the new bearer', async () => {
    await setToken('google', 'accessToken', 'g_old');
    await setToken('google', 'refreshToken', 'g_refresh_v1');
    await setToken('google', 'clientId', 'cid');
    const backend: AppAuthBackend = {
      authorize: jest.fn(),
      refresh: jest.fn(async () => ({
        accessToken: 'g_new',
        accessTokenExpirationDate: '2030-02-01T00:00:00.000Z',
      })),
    };
    installOAuthBackend(backend);

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('g_new');

    expect(SecureStore.__store.get('nexus_google_accessToken')).toBe('g_new');
    expect(SecureStore.__store.get('nexus_google_tokenExpiry')).toBe('2030-02-01T00:00:00.000Z');
    expect(SecureStore.__store.get('nexus_google_refreshToken')).toBe('g_refresh_v1');
  });

  it('returns SESSION_EXPIRED when no refresh token is stored', async () => {
    await setToken('google', 'accessToken', 'g_access');
    await setToken('google', 'clientId', 'cid');
    installOAuthBackend({ authorize: jest.fn(), refresh: jest.fn() });
    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('returns SESSION_EXPIRED when the backend refresh call rejects', async () => {
    await setToken('google', 'refreshToken', 'g_refresh');
    await setToken('google', 'clientId', 'cid');
    const backend: AppAuthBackend = {
      authorize: jest.fn(),
      refresh: jest.fn(async () => {
        throw new NexusError('SESSION_EXPIRED', 'invalid_grant');
      }),
    };
    installOAuthBackend(backend);
    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns SESSION_EXPIRED when no client ID is stored', async () => {
    await setToken('google', 'refreshToken', 'g_refresh');
    installOAuthBackend({ authorize: jest.fn(), refresh: jest.fn() });
    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SESSION_EXPIRED');
  });
});
