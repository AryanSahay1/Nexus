/**
 * Unit tests for src/services/apiClient.ts.
 *
 * Strategy: install a fake Axios adapter on the module's shared instance so
 * we control every HTTP response. The adapter sees the exact `AxiosRequestConfig`
 * the production code constructs, including the `Authorization` header that
 * the request interceptor injects from `tokenService`.
 */

import type { AxiosAdapter, AxiosResponse } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';

import { NexusError, type Provider, type Result, err, ok } from '../../src/types/auth';

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

import {
  __internal as apiInternal,
  installRefreshHandler,
  nexusRequest,
} from '../../src/services/apiClient';

// Local Axios shape used by the fake adapter.
type FakeResult =
  | { kind: 'ok'; status: number; data: unknown }
  | { kind: 'err'; status: number; data: unknown };

interface CapturedCall {
  readonly url: string | undefined;
  readonly authorization: string | undefined;
}
const buildAdapter = (sequence: readonly FakeResult[]): {
  adapter: AxiosAdapter;
  calls: CapturedCall[];
} => {
  const calls: CapturedCall[] = [];
  let i = 0;
  const adapter: AxiosAdapter = async (config) => {
    // Capture a snapshot — the same `config` object is mutated in-place by
    // the response interceptor on retry, so reading headers later would
    // only ever show the latest value.
    calls.push({
      url: config.url,
      authorization: config.headers.get('Authorization') as string | undefined,
    });
    const next = sequence[i] ?? sequence[sequence.length - 1];
    i += 1;
    if (next === undefined) {
      throw new Error('test adapter exhausted');
    }
    const headers = new AxiosHeaders();
    const response: AxiosResponse = {
      data: next.data,
      status: next.status,
      statusText: 'OK',
      headers,
      config,
    };
    if (next.kind === 'ok') return response;
    throw new AxiosError(
      `HTTP ${next.status}`,
      String(next.status),
      config,
      undefined,
      response,
    );
  };
  return { adapter, calls };
};

beforeEach(() => {
  apiInternal.resetForTests();
  jest.clearAllMocks();
  (SecureStore.getItemAsync as jest.Mock).mockReset();
});

describe('nexusRequest — happy path', () => {
  it('attaches a Bearer header from tokenService and returns ok(body)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
      key === 'nexus_google_accessToken' ? 'access-1' : null,
    );

    const { adapter, calls } = buildAdapter([
      { kind: 'ok', status: 200, data: { messages: ['hello'] } },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest<{ messages: string[] }>({
      method: 'GET',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      provider: 'google',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.messages).toEqual(['hello']);
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBe('Bearer access-1');
  });

  it('skips auth when skipAuth is true', async () => {
    const { adapter, calls } = buildAdapter([
      { kind: 'ok', status: 200, data: { id: 'x' } },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      skipAuth: true,
      headers: { Authorization: 'Bearer sk-from-caller' },
      body: { model: 'gpt-4o-mini' },
    });

    expect(result.ok).toBe(true);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(calls[0]?.authorization).toBe('Bearer sk-from-caller');
  });
});

describe('nexusRequest — 401 retry', () => {
  it('refreshes once and retries with the new bearer on success', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired-token');

    const refresh = jest.fn(
      async (_provider: Provider): Promise<Result<string, NexusError>> => ok('rotated-token'),
    );
    installRefreshHandler(refresh);

    const { adapter, calls } = buildAdapter([
      { kind: 'err', status: 401, data: { error: 'expired' } },
      { kind: 'ok', status: 200, data: { ok: true } },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      provider: 'google',
    });

    expect(result.ok).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    // Original request used the stale token, the retry used the rotated one.
    expect(calls[0]?.authorization).toBe('Bearer expired-token');
    expect(calls[1]?.authorization).toBe('Bearer rotated-token');
  });

  it('returns SESSION_EXPIRED when the refresh hook reports failure', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired-token');

    const refresh = jest.fn(
      async (): Promise<Result<string, NexusError>> =>
        err(new NexusError('SESSION_EXPIRED', 'no refresh available')),
    );
    installRefreshHandler(refresh);

    const { adapter, calls } = buildAdapter([
      { kind: 'err', status: 401, data: { error: 'expired' } },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      provider: 'google',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NexusError);
      expect(result.error.code).toBe('SESSION_EXPIRED');
      expect(result.error.isRetryable).toBe(false);
    }
    expect(calls).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('returns SESSION_EXPIRED when the retried request also returns 401', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired-token');

    const refresh = jest.fn(
      async (): Promise<Result<string, NexusError>> => ok('rotated-token'),
    );
    installRefreshHandler(refresh);

    const { adapter, calls } = buildAdapter([
      { kind: 'err', status: 401, data: { error: 'expired' } },
      { kind: 'err', status: 401, data: { error: 'still expired' } },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      provider: 'google',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
    }
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it('does not refresh when no provider is set on the request', async () => {
    const refresh = jest.fn();
    installRefreshHandler(refresh);

    const { adapter } = buildAdapter([
      { kind: 'err', status: 401, data: { error: 'unauthorized' } },
    ]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      skipAuth: true,
      body: { x: 1 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_EXPIRED');
    }
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('nexusRequest — error mapping', () => {
  it('maps 403 → PERMISSION_DENIED, non-retryable', async () => {
    const { adapter } = buildAdapter([{ kind: 'err', status: 403, data: {} }]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://example.test/x',
      skipAuth: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PERMISSION_DENIED');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('maps 404 → NOT_FOUND, non-retryable', async () => {
    const { adapter } = buildAdapter([{ kind: 'err', status: 404, data: {} }]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://example.test/missing',
      skipAuth: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('maps 5xx → PROVIDER_ERROR, retryable', async () => {
    const { adapter } = buildAdapter([{ kind: 'err', status: 502, data: {} }]);
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://example.test/x',
      skipAuth: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.isRetryable).toBe(true);
    }
  });

  it('maps timeouts → NETWORK_ERROR, retryable', async () => {
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError('timeout', 'ECONNABORTED', config, undefined, undefined);
    };
    apiInternal.getInstance().defaults.adapter = adapter;

    const result = await nexusRequest({
      method: 'GET',
      url: 'https://example.test/x',
      skipAuth: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.isRetryable).toBe(true);
    }
  });
});
