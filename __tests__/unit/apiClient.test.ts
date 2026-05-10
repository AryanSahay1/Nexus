/**
 * Unit tests for src/services/apiClient.ts.
 *
 * The Axios layer is exercised against a stub adapter that resolves and
 * rejects on demand so each interceptor branch is testable in isolation.
 * The token-injection branch leans on the existing expo-secure-store mock.
 */

import * as SecureStoreReal from 'expo-secure-store';
import {
  type AxiosAdapter,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { NexusError, ok, err, type Result } from '../../src/types/auth';
import {
  __resetForTests,
  createNexusApiClient,
  installApiClientDeps,
  requestAsResult,
  SessionExpiredError,
  type NexusRequestConfig,
} from '../../src/services/apiClient';
import { setToken } from '../../src/services/tokenService';

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

interface StubResponse {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

interface AdapterScript {
  /** Per-call planned outcomes; consumed in order. */
  outcomes: StubResponse[];
  /** Token authoritatively reported in headers per call. */
  observed: { authorization?: string; url?: string }[];
}

const installAdapter = (script: AdapterScript): AxiosAdapter => {
  return async (cfg: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const outcome = script.outcomes.shift();
    if (!outcome) throw new Error('Adapter script exhausted unexpectedly.');
    const auth = (cfg.headers as unknown as { get: (k: string) => string | null }).get('Authorization');
    script.observed.push({
      ...(auth !== null ? { authorization: auth } : {}),
      ...(cfg.url !== undefined ? { url: cfg.url } : {}),
    });
    if (outcome.status >= 400) {
      const error: AxiosError = Object.assign(new Error(`HTTP ${outcome.status}`), {
        isAxiosError: true,
        config: cfg,
        response: {
          status: outcome.status,
          data: outcome.data,
          headers: outcome.headers ?? {},
          statusText: '',
          config: cfg,
        },
        toJSON: () => ({}),
      }) as AxiosError;
      throw error;
    }
    return {
      data: outcome.data ?? {},
      status: outcome.status,
      statusText: 'OK',
      headers: outcome.headers ?? {},
      config: cfg,
    } as AxiosResponse;
  };
};

beforeEach(() => {
  SecureStore.__reset();
  __resetForTests();
  jest.clearAllMocks();
});

describe('request interceptor — token injection', () => {
  it('injects the openai apiKey as a Bearer for nexusProvider=openai', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345678901234567890');
    const script: AdapterScript = { outcomes: [{ status: 200, data: { ok: true } }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    await client.request({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      nexusProvider: 'openai',
    } as NexusRequestConfig);
    expect(script.observed[0]?.authorization).toBe('Bearer sk-test-12345678901234567890');
  });

  it('injects the google accessToken as a Bearer for nexusProvider=google', async () => {
    await setToken('google', 'accessToken', 'g_access_token_value');
    const script: AdapterScript = { outcomes: [{ status: 200, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    await client.request({
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      nexusProvider: 'google',
    } as NexusRequestConfig);
    expect(script.observed[0]?.authorization).toBe('Bearer g_access_token_value');
  });

  it('omits the Authorization header when nexusProvider is unset', async () => {
    const script: AdapterScript = { outcomes: [{ status: 200, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    await client.request({ url: 'https://example.com/health' });
    expect(script.observed[0]?.authorization).toBeUndefined();
  });

  it('proceeds without injection when the bearer is missing in SecureStore', async () => {
    const script: AdapterScript = { outcomes: [{ status: 200, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    await client.request({
      url: 'https://api.openai.com/v1/models',
      nexusProvider: 'openai',
    } as NexusRequestConfig);
    expect(script.observed[0]?.authorization).toBeUndefined();
  });
});

describe('response interceptor — 401 refresh path (google)', () => {
  it('runs refresh once and replays the original request with the new token', async () => {
    await setToken('google', 'accessToken', 'g_old_token');
    const refresh = jest.fn(async (): Promise<Result<string, NexusError>> => {
      await setToken('google', 'accessToken', 'g_new_token');
      return ok('g_new_token');
    });
    const onDisconnected = jest.fn();
    installApiClientDeps({ refresh, onDisconnected });

    const script: AdapterScript = {
      outcomes: [
        { status: 401, data: { error: 'expired' } },
        { status: 200, data: { messages: [] } },
      ],
      observed: [],
    };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);

    const response = await client.request({
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      nexusProvider: 'google',
    } as NexusRequestConfig);

    expect(response.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onDisconnected).not.toHaveBeenCalled();
    expect(script.observed[0]?.authorization).toBe('Bearer g_old_token');
    expect(script.observed[1]?.authorization).toBe('Bearer g_new_token');
  });

  it('does NOT refresh again on a second 401 of the retried request (prevents infinite loop)', async () => {
    await setToken('google', 'accessToken', 'g_old');
    const refresh = jest.fn(async () => {
      await setToken('google', 'accessToken', 'g_new');
      return ok('g_new');
    });
    installApiClientDeps({ refresh, onDisconnected: jest.fn() });

    const script: AdapterScript = {
      outcomes: [
        { status: 401, data: {} },
        { status: 401, data: {} },
      ],
      observed: [],
    };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);

    await expect(
      client.request({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
        nexusProvider: 'google',
      } as NexusRequestConfig),
    ).rejects.toBeInstanceOf(NexusError);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does NOT refresh for nexusProvider=openai (no refresh-token flow)', async () => {
    await setToken('openai', 'apiKey', 'sk-key-123456789012345');
    const refresh = jest.fn();
    installApiClientDeps({ refresh, onDisconnected: jest.fn() });

    const script: AdapterScript = { outcomes: [{ status: 401, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);

    await expect(
      client.request({
        url: 'https://api.openai.com/v1/chat/completions',
        nexusProvider: 'openai',
      } as NexusRequestConfig),
    ).rejects.toBeInstanceOf(NexusError);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('on refresh failure: marks provider disconnected and rejects with SessionExpiredError', async () => {
    await setToken('google', 'accessToken', 'g_old');
    const refresh = jest.fn(
      async () => err(new NexusError('SESSION_EXPIRED', 'no refresh token')),
    );
    const onDisconnected = jest.fn();
    installApiClientDeps({ refresh, onDisconnected });

    const script: AdapterScript = { outcomes: [{ status: 401, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);

    await expect(
      client.request({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
        nexusProvider: 'google',
      } as NexusRequestConfig),
    ).rejects.toBeInstanceOf(SessionExpiredError);
    expect(onDisconnected).toHaveBeenCalledWith('google');
  });

  it('shares one refresh across concurrent 401s (PRD §4 D-2)', async () => {
    await setToken('google', 'accessToken', 'g_old');
    let refreshCount = 0;
    const refresh = jest.fn(async () => {
      refreshCount += 1;
      await new Promise((r) => setTimeout(r, 10));
      await setToken('google', 'accessToken', 'g_new');
      return ok('g_new');
    });
    installApiClientDeps({ refresh, onDisconnected: jest.fn() });

    const script: AdapterScript = {
      outcomes: [
        { status: 401, data: {} },
        { status: 401, data: {} },
        { status: 401, data: {} },
        { status: 200, data: { ok: 1 } },
        { status: 200, data: { ok: 2 } },
        { status: 200, data: { ok: 3 } },
      ],
      observed: [],
    };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);

    const results = await Promise.all([
      client.request({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1',
        nexusProvider: 'google',
      } as NexusRequestConfig),
      client.request({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=2',
        nexusProvider: 'google',
      } as NexusRequestConfig),
      client.request({
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3',
        nexusProvider: 'google',
      } as NexusRequestConfig),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refreshCount).toBe(1);
  });
});

describe('response interceptor — error mapping', () => {
  it('maps 429 with Retry-After to RATE_LIMITED isRetryable=true', async () => {
    const script: AdapterScript = {
      outcomes: [{ status: 429, headers: { 'retry-after': '12' }, data: {} }],
      observed: [],
    };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    try {
      await client.request({ url: 'https://api.openai.com/v1/chat/completions' });
      throw new Error('expected throw');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NexusError);
      const e = caught as NexusError;
      expect(e.code).toBe('RATE_LIMITED');
      expect(e.isRetryable).toBe(true);
      expect(e.message).toContain('12');
    }
  });

  it('maps 5xx to NETWORK_ERROR isRetryable=true', async () => {
    const script: AdapterScript = { outcomes: [{ status: 503, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    try {
      await client.request({ url: 'https://api.openai.com/v1/chat/completions' });
      throw new Error('expected throw');
    } catch (caught) {
      const e = caught as NexusError;
      expect(e.code).toBe('NETWORK_ERROR');
      expect(e.isRetryable).toBe(true);
    }
  });

  it('maps other 4xx to PROVIDER_ERROR isRetryable=false', async () => {
    const script: AdapterScript = { outcomes: [{ status: 400, data: { error: 'bad' } }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    try {
      await client.request({ url: 'https://api.openai.com/v1/chat/completions' });
      throw new Error('expected throw');
    } catch (caught) {
      const e = caught as NexusError;
      expect(e.code).toBe('PROVIDER_ERROR');
      expect(e.isRetryable).toBe(false);
    }
  });
});

describe('requestAsResult', () => {
  it('returns Ok on 2xx', async () => {
    const script: AdapterScript = { outcomes: [{ status: 200, data: { hello: 'world' } }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    const result = await requestAsResult<{ hello: string }>(client, { url: 'x' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hello).toBe('world');
  });

  it('returns Err with the typed NexusError on rejection', async () => {
    const script: AdapterScript = { outcomes: [{ status: 500, data: {} }], observed: [] };
    const client = createNexusApiClient();
    client.defaults.adapter = installAdapter(script);
    const result = await requestAsResult(client, { url: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NETWORK_ERROR');
  });
});
