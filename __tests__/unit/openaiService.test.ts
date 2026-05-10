/**
 * Unit tests for src/services/openaiService.ts.
 *
 * Drives the chatCompletion path through a stubbed axios adapter that
 * captures the outgoing request body so we can assert the wire contract
 * matches OpenAI's expected shape exactly.
 */

import * as SecureStoreReal from 'expo-secure-store';
import {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from 'axios';

import {
  __setHttpClientForTests,
  chatCompletion,
  transcribeAudio,
  validateApiKey,
} from '../../src/services/openaiService';
import { createNexusApiClient } from '../../src/services/apiClient';
import { setToken } from '../../src/services/tokenService';

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

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

interface CapturedCall {
  url?: string;
  authorization?: string;
  body?: unknown;
}

const installAdapter = (
  outcomes: { status: number; data?: unknown }[],
  captured: CapturedCall[],
): AxiosAdapter => async (cfg: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const auth = (cfg.headers as unknown as { get: (k: string) => string | null }).get('Authorization');
  captured.push({
    ...(cfg.url !== undefined ? { url: cfg.url } : {}),
    ...(auth !== null ? { authorization: auth } : {}),
    body: cfg.data,
  });
  const next = outcomes.shift();
  if (!next) throw new Error('Adapter outcomes exhausted.');
  if (next.status >= 400) {
    const error: AxiosError = Object.assign(new Error(`HTTP ${next.status}`), {
      isAxiosError: true,
      config: cfg,
      response: { status: next.status, data: next.data, headers: {}, statusText: '', config: cfg },
      toJSON: () => ({}),
    }) as AxiosError;
    throw error;
  }
  return {
    data: next.data ?? {},
    status: next.status,
    statusText: 'OK',
    headers: {},
    config: cfg,
  } as AxiosResponse;
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  const client = createNexusApiClient();
  __setHttpClientForTests(client);
});

afterAll(() => {
  __setHttpClientForTests(null);
});

describe('validateApiKey', () => {
  it('accepts a well-formed key', () => {
    const r = validateApiKey('sk-abcdefghijklmnopqrstuvwx');
    expect(r.ok).toBe(true);
  });

  it('rejects non-strings', () => {
    expect(validateApiKey(undefined).ok).toBe(false);
    expect(validateApiKey(123).ok).toBe(false);
    expect(validateApiKey(null).ok).toBe(false);
  });

  it('rejects empty / whitespace-only', () => {
    expect(validateApiKey('').ok).toBe(false);
    expect(validateApiKey('   ').ok).toBe(false);
  });

  it('rejects keys without sk- prefix', () => {
    expect(validateApiKey('not-a-real-key-12345').ok).toBe(false);
  });

  it('rejects keys with internal whitespace', () => {
    expect(validateApiKey('sk- abcdefghijklmnopqr').ok).toBe(false);
  });

  it('rejects too-short keys', () => {
    expect(validateApiKey('sk-short').ok).toBe(false);
  });
});

describe('chatCompletion', () => {
  it('POSTs to /v1/chat/completions with the user apiKey injected by the apiClient', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345678901234567890');
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { id: 'cmpl_1', choices: [] } }],
      captured,
    );
    __setHttpClientForTests(c);

    const result = await chatCompletion({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
      toolChoice: 'auto',
    });

    expect(result.ok).toBe(true);
    expect(captured[0]?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(captured[0]?.authorization).toBe('Bearer sk-test-12345678901234567890');
    const body = JSON.parse(String(captured[0]?.body));
    expect(body.model).toBe('gpt-4o');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.temperature).toBe(0.2);
    expect(body.tool_choice).toBe('auto');
  });

  it('omits tool_choice and tools when none are provided', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345678901234567890');
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { id: '', choices: [] } }],
      captured,
    );
    __setHttpClientForTests(c);
    await chatCompletion({
      model: '',
      messages: [{ role: 'user', content: 'hi' }],
    });
    const body = JSON.parse(String(captured[0]?.body));
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.model).toBe('gpt-4o');
  });

  it('returns Err on a 5xx upstream response', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345678901234567890');
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([{ status: 500, data: {} }], []);
    __setHttpClientForTests(c);
    const r = await chatCompletion({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NETWORK_ERROR');
  });
});

describe('transcribeAudio', () => {
  it('rejects an empty URI without making a network call', async () => {
    const result = await transcribeAudio({ uri: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('POSTs to /v1/audio/transcriptions with the apiKey injected', async () => {
    await setToken('openai', 'apiKey', 'sk-test-12345678901234567890');
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { text: 'hello world' } }],
      captured,
    );
    __setHttpClientForTests(c);
    const result = await transcribeAudio({ uri: 'file:///tmp/audio.m4a' });
    expect(result.ok).toBe(true);
    expect(captured[0]?.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(captured[0]?.authorization).toBe('Bearer sk-test-12345678901234567890');
  });
});
