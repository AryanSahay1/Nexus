/**
 * Unit tests for src/services/googleService.ts.
 *
 * The axios stub adapter records every outbound request so tests assert
 * the wire shape against the documented Google API contract.
 */

import * as SecureStoreReal from 'expo-secure-store';
import {
  type AxiosAdapter,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  __internal,
  __setHttpClientForTests,
  buildGmailRawPayload,
  buildRfc2822,
  createCalendarEvent,
  getNextCalendarEvent,
  listGmailMessages,
  sendGmailMessage,
} from '../../src/services/googleService';
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
  method?: string;
  url?: string;
  params?: unknown;
  body?: unknown;
}

const installAdapter = (
  outcomes: { status: number; data?: unknown }[],
  captured: CapturedCall[],
): AxiosAdapter => async (cfg: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  captured.push({
    ...(cfg.method !== undefined ? { method: cfg.method } : {}),
    ...(cfg.url !== undefined ? { url: cfg.url } : {}),
    params: cfg.params,
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

beforeEach(async () => {
  SecureStore.__reset();
  jest.clearAllMocks();
  await setToken('google', 'accessToken', 'g_access_test_value');
  __setHttpClientForTests(createNexusApiClient());
});

afterAll(() => {
  __setHttpClientForTests(null);
});

describe('listGmailMessages', () => {
  it('clamps limit to [1, 10] and includes the user query when provided', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        { status: 200, data: { messages: [] } },
      ],
      captured,
    );
    __setHttpClientForTests(c);

    await listGmailMessages({ limit: 99, query: 'from:alice@example.com is:unread' });
    expect(captured[0]?.url).toBe(`${__internal.GMAIL_BASE}/messages`);
    expect(captured[0]?.params).toEqual({
      maxResults: '10',
      q: 'from:alice@example.com is:unread',
    });
  });

  it('clamps limit upward to 1 and omits q when query is empty', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { messages: [] } }],
      captured,
    );
    __setHttpClientForTests(c);
    await listGmailMessages({ limit: 0 });
    expect(captured[0]?.params).toEqual({ maxResults: '1' });
  });

  it('fans out to per-message metadata fetches and shapes the result', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: { messages: [{ id: 'm1', threadId: 't1' }] },
        },
        {
          status: 200,
          data: {
            id: 'm1',
            threadId: 't1',
            snippet: 'Hello there',
            internalDate: '1717200000000',
            payload: {
              headers: [
                { name: 'From', value: 'alice@example.com' },
                { name: 'Subject', value: 'Test' },
                { name: 'Date', value: 'Mon, 1 Jun 2024 00:00:00 +0000' },
              ],
            },
          },
        },
      ],
      captured,
    );
    __setHttpClientForTests(c);

    const result = await listGmailMessages({ limit: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        id: 'm1',
        threadId: 't1',
        from: 'alice@example.com',
        subject: 'Test',
        snippet: 'Hello there',
      });
      expect(result.value[0]?.dateIso).toBeDefined();
    }
    expect(captured[1]?.params).toEqual({
      format: 'metadata',
      metadataHeaders: 'From,Subject,Date',
    });
  });

  it('propagates an upstream Err from the list call without fanning out', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([{ status: 500 }], captured);
    __setHttpClientForTests(c);
    const result = await listGmailMessages({ limit: 5 });
    expect(result.ok).toBe(false);
    expect(captured).toHaveLength(1);
  });
});

describe('Gmail send (RFC 2822 + base64url)', () => {
  it('buildRfc2822 includes To, Subject, MIME headers, blank line, body', () => {
    const out = buildRfc2822({ to: 'a@b.com', subject: 'Hi', body: 'hello\nworld' });
    expect(out).toContain('To: a@b.com');
    expect(out).toContain('Subject: Hi');
    expect(out).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(out).toContain('MIME-Version: 1.0');
    expect(out.split('\r\n')).toContain('');
    expect(out.endsWith('hello\nworld')).toBe(true);
  });

  it('buildGmailRawPayload produces a base64url string with no padding', () => {
    const raw = buildGmailRawPayload({ to: 'a@b.com', subject: 'Hi', body: 'hello' });
    expect(raw).not.toContain('=');
    expect(raw).not.toContain('+');
    expect(raw).not.toContain('/');
    expect(/^[A-Za-z0-9\-_]+$/.test(raw)).toBe(true);
  });

  it('sendGmailMessage POSTs the canonical {raw} body shape', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { id: 'sent_1', threadId: 't_1' } }],
      captured,
    );
    __setHttpClientForTests(c);

    const result = await sendGmailMessage({ to: 'a@b.com', subject: 'Hi', body: 'hello' });
    expect(result.ok).toBe(true);
    expect(captured[0]?.url).toBe(`${__internal.GMAIL_BASE}/messages/send`);
    expect(captured[0]?.method).toBe('post');
    expect(captured[0]?.body).toBeDefined();
    const body = JSON.parse(String(captured[0]?.body));
    expect(typeof body.raw).toBe('string');
    expect(body.raw.length).toBeGreaterThan(0);
  });

  it('rejects an obviously invalid recipient email without making any call', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([], captured);
    __setHttpClientForTests(c);
    const result = await sendGmailMessage({ to: 'not-an-email', subject: 'x', body: 'y' });
    expect(result.ok).toBe(false);
    expect(captured).toHaveLength(0);
  });
});

describe('createCalendarEvent', () => {
  it('POSTs the canonical body shape with summary, start, end', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        { status: 200, data: { id: 'evt_1', htmlLink: 'https://calendar.google.com/event?eid=abc' } },
      ],
      captured,
    );
    __setHttpClientForTests(c);

    const result = await createCalendarEvent({
      summary: 'Sync with Sarah',
      startIso: '2030-06-15T14:00:00.000Z',
      endIso: '2030-06-15T15:00:00.000Z',
      timezone: 'Asia/Kolkata',
      attendees: ['sarah@example.com'],
      description: 'Project sync',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('evt_1');
      expect(result.value.htmlLink).toBe('https://calendar.google.com/event?eid=abc');
    }
    const body = JSON.parse(String(captured[0]?.body));
    expect(body.summary).toBe('Sync with Sarah');
    expect(body.start).toEqual({ dateTime: '2030-06-15T14:00:00.000Z', timeZone: 'Asia/Kolkata' });
    expect(body.end).toEqual({ dateTime: '2030-06-15T15:00:00.000Z', timeZone: 'Asia/Kolkata' });
    expect(body.attendees).toEqual([{ email: 'sarah@example.com' }]);
    expect(body.description).toBe('Project sync');
  });

  it('rejects events where end <= start without calling the API', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([], captured);
    __setHttpClientForTests(c);
    const result = await createCalendarEvent({
      summary: 'Sync',
      startIso: '2030-01-01T10:00:00.000Z',
      endIso: '2030-01-01T09:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    expect(captured).toHaveLength(0);
  });
});

describe('getNextCalendarEvent', () => {
  it('returns null when the API returns no items', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([{ status: 200, data: { items: [] } }], []);
    __setHttpClientForTests(c);
    const result = await getNextCalendarEvent(new Date('2030-01-01T00:00:00.000Z'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('shapes the next event into the slim CalendarEvent type', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            items: [
              {
                id: 'evt_2',
                summary: 'Standup',
                start: { dateTime: '2030-01-01T01:00:00.000Z' },
                end: { dateTime: '2030-01-01T01:30:00.000Z' },
                htmlLink: 'https://calendar.google.com/event?eid=xyz',
              },
            ],
          },
        },
      ],
      [],
    );
    __setHttpClientForTests(c);
    const result = await getNextCalendarEvent(new Date('2030-01-01T00:00:00.000Z'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        id: 'evt_2',
        summary: 'Standup',
        startIso: '2030-01-01T01:00:00.000Z',
        endIso: '2030-01-01T01:30:00.000Z',
        htmlLink: 'https://calendar.google.com/event?eid=xyz',
      });
    }
  });
});
