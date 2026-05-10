/**
 * Unit tests for src/services/oauthService.ts.
 *
 * The native OAuth backend is supplied via `installOAuthBackend()` so each
 * test wires a tiny stub that returns canned authorize/refresh shapes. The
 * SecureStore mock is the same in-memory map used by tokenService tests.
 */

import { NexusError, type Provider, type Result } from '../../src/types/auth';

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

import * as SecureStoreReal from 'expo-secure-store';
import {
  __internal as oauthInternal,
  buildGoogleConfig,
  connect,
  decodeIdToken,
  disconnect,
  installOAuthBackend,
  refreshAccessToken,
  wireApiClientRefresh,
  type OAuthBackend,
} from '../../src/services/oauthService';
import { __internal as apiInternal } from '../../src/services/apiClient';
import * as tokenService from '../../src/services/tokenService';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  oauthInternal.resetForTests();
  apiInternal.resetForTests();
});

// ── buildGoogleConfig ────────────────────────────────────────────────────

describe('buildGoogleConfig', () => {
  it('returns the canonical issuer / redirect URL / scopes', () => {
    const cfg = buildGoogleConfig('client-1');
    expect(cfg.issuer).toBe(oauthInternal.GOOGLE_ISSUER);
    expect(cfg.redirectUrl).toBe(oauthInternal.GOOGLE_REDIRECT_URL);
    expect(cfg.scopes).toEqual(oauthInternal.GOOGLE_SCOPES);
    expect(cfg.additionalParameters.access_type).toBe('offline');
    expect(cfg.additionalParameters.prompt).toBe('consent');
    expect(cfg.clientId).toBe('client-1');
  });

  it('respects exactly the documented scopes (gmail.readonly + send + calendar + openid email profile)', () => {
    const cfg = buildGoogleConfig('client-1');
    expect(cfg.scopes).toContain('openid');
    expect(cfg.scopes).toContain('email');
    expect(cfg.scopes).toContain('profile');
    expect(cfg.scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(cfg.scopes).toContain('https://www.googleapis.com/auth/gmail.send');
    expect(cfg.scopes).toContain('https://www.googleapis.com/auth/calendar');
  });
});

// ── decodeIdToken ────────────────────────────────────────────────────────

const buildIdToken = (claims: Readonly<Record<string, unknown>>): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${header}.${payload}.fake-signature`;
};

describe('decodeIdToken', () => {
  it('returns the email claim from a valid JWT', () => {
    const idToken = buildIdToken({ email: 'jane@example.com', sub: '123', iat: 1700000000 });
    expect(decodeIdToken(idToken)).toBe('jane@example.com');
  });

  it('returns null when email is missing', () => {
    const idToken = buildIdToken({ sub: 'no-email-here' });
    expect(decodeIdToken(idToken)).toBeNull();
  });

  it('returns null on malformed input — not three segments', () => {
    expect(decodeIdToken('only.two')).toBeNull();
    expect(decodeIdToken('')).toBeNull();
    expect(decodeIdToken('not-a-jwt-at-all')).toBeNull();
  });

  it('returns null when the payload is not valid base64 JSON', () => {
    // Three segments but the middle is garbage.
    expect(decodeIdToken('aaa.@@@@@@@@.bbb')).toBeNull();
  });
});

// ── connect ─────────────────────────────────────────────────────────────

describe('connect', () => {
  const buildBackend = (overrides: Partial<OAuthBackend> = {}): OAuthBackend => ({
    authorize: jest.fn(async () => ({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpirationDate: '2026-12-31T23:59:59Z',
      idToken: buildIdToken({ email: 'jane@example.com' }),
      tokenType: 'Bearer',
      scopes: oauthInternal.GOOGLE_SCOPES,
    })),
    refresh: jest.fn(async () => ({
      accessToken: 'rotated',
      refreshToken: null,
      accessTokenExpirationDate: '2027-01-01T00:00:00Z',
    })),
    ...overrides,
  });

  it('runs authorize, decodes email, and persists each field separately (LAW 5)', async () => {
    const backend = buildBackend();
    installOAuthBackend(backend);
    const result = await connect('test-client-id');

    expect(result.ok).toBe(true);
    expect(backend.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'test-client-id' }),
    );

    const accessToken = await tokenService.getToken('google', 'accessToken');
    const refreshToken = await tokenService.getToken('google', 'refreshToken');
    const expiry = await tokenService.getToken('google', 'tokenExpiry');
    const email = await tokenService.getToken('google', 'userEmail');
    const clientId = await tokenService.getToken('google', 'clientId');

    expect(accessToken.ok && accessToken.value).toBe('access-1');
    expect(refreshToken.ok && refreshToken.value).toBe('refresh-1');
    expect(expiry.ok && expiry.value).toBe('2026-12-31T23:59:59Z');
    expect(email.ok && email.value).toBe('jane@example.com');
    expect(clientId.ok && clientId.value).toBe('test-client-id');
  });

  it('rejects an empty clientId without invoking the backend', async () => {
    const backend = buildBackend();
    installOAuthBackend(backend);

    const result = await connect('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
    expect(backend.authorize).not.toHaveBeenCalled();
  });

  it('returns SESSION_EXPIRED if the backend rejects authorize()', async () => {
    const backend = buildBackend({
      authorize: jest.fn(async () => {
        throw new Error('user_cancelled');
      }),
    });
    installOAuthBackend(backend);

    const result = await connect('client-id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NexusError);
      expect(result.error.code).toBe('SESSION_EXPIRED');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('returns PROVIDER_ERROR if the backend was never installed', async () => {
    installOAuthBackend(null);
    const result = await connect('client-id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
    }
  });
});

// ── disconnect ──────────────────────────────────────────────────────────

describe('disconnect', () => {
  it('wipes every credential for the given provider', async () => {
    await tokenService.setToken('google', 'accessToken', 'a');
    await tokenService.setToken('google', 'refreshToken', 'r');
    await tokenService.setToken('google', 'userEmail', 'jane@example.com');

    const result = await disconnect('google');
    expect(result.ok).toBe(true);

    const access = await tokenService.getToken('google', 'accessToken');
    const refresh = await tokenService.getToken('google', 'refreshToken');
    const email = await tokenService.getToken('google', 'userEmail');
    expect(access.ok).toBe(false);
    expect(refresh.ok).toBe(false);
    expect(email.ok).toBe(false);
  });

  it('is idempotent — succeeds even if nothing was stored', async () => {
    const result = await disconnect('google');
    expect(result.ok).toBe(true);
  });
});

// ── refreshAccessToken ──────────────────────────────────────────────────

describe('refreshAccessToken', () => {
  const seedConnected = async (): Promise<void> => {
    await tokenService.setToken('google', 'refreshToken', 'old-refresh');
    await tokenService.setToken('google', 'clientId', 'client-1');
  };

  it('rotates the access token and persists the new bundle', async () => {
    await seedConnected();
    installOAuthBackend({
      authorize: jest.fn(),
      refresh: jest.fn(async () => ({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        accessTokenExpirationDate: '2027-01-01T00:00:00Z',
      })),
    });

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('new-access');
    }
    const stored = await tokenService.getToken('google', 'accessToken');
    expect(stored.ok && stored.value).toBe('new-access');
    const refresh = await tokenService.getToken('google', 'refreshToken');
    expect(refresh.ok && refresh.value).toBe('new-refresh');
  });

  it('keeps the old refresh token when the AS does not return a new one', async () => {
    await seedConnected();
    installOAuthBackend({
      authorize: jest.fn(),
      refresh: jest.fn(async () => ({
        accessToken: 'new-access',
        refreshToken: null,
        accessTokenExpirationDate: '2027-01-01T00:00:00Z',
      })),
    });

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(true);
    const refresh = await tokenService.getToken('google', 'refreshToken');
    expect(refresh.ok && refresh.value).toBe('old-refresh');
  });

  it('returns SESSION_EXPIRED when no refresh token is stored', async () => {
    await tokenService.setToken('google', 'clientId', 'client-1');
    installOAuthBackend({
      authorize: jest.fn(),
      refresh: jest.fn(),
    });

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
    }
  });

  it('returns SESSION_EXPIRED when no clientId is stored', async () => {
    await tokenService.setToken('google', 'refreshToken', 'r');
    installOAuthBackend({
      authorize: jest.fn(),
      refresh: jest.fn(),
    });

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
    }
  });

  it('returns SESSION_EXPIRED when the backend throws', async () => {
    await seedConnected();
    installOAuthBackend({
      authorize: jest.fn(),
      refresh: jest.fn(async () => {
        throw new Error('upstream rejected');
      }),
    });

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('returns SESSION_EXPIRED when the backend was never installed', async () => {
    await seedConnected();
    installOAuthBackend(null);

    const result = await refreshAccessToken('google');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
    }
  });

  it('rejects providers other than google', async () => {
    const result = await refreshAccessToken('whatsapp' as Provider);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
    }
  });
});

// ── wireApiClientRefresh ────────────────────────────────────────────────

describe('wireApiClientRefresh', () => {
  it('installs a handler that delegates to refreshAccessToken', async () => {
    await tokenService.setToken('google', 'refreshToken', 'r');
    await tokenService.setToken('google', 'clientId', 'c');
    installOAuthBackend({
      authorize: jest.fn(),
      refresh: jest.fn(async () => ({
        accessToken: 'rotated',
        refreshToken: 'r',
        accessTokenExpirationDate: '2027-01-01T00:00:00Z',
      })),
    });

    wireApiClientRefresh();
    const handler = apiInternal.getRefreshHandler();
    expect(handler).not.toBeNull();
    const result: Result<string, NexusError> = await handler!('google');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('rotated');
    }
  });
});
