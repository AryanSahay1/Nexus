/**
 * Unit tests for googleService.listCalendarEvents — the new range-query
 * variant added for the Calendar screen.
 */

import * as SecureStoreReal from 'expo-secure-store';
import {
  type AxiosAdapter,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

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
  };
});

// eslint-disable-next-line import/first
import {
  __setHttpClientForTests,
  listCalendarEvents,
} from '../../src/services/googleService';
// eslint-disable-next-line import/first
import { createNexusApiClient } from '../../src/services/apiClient';
// eslint-disable-next-line import/first
import { setToken } from '../../src/services/tokenService';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

interface CapturedCall {
  url?: string;
  params?: unknown;
}

const installAdapter = (
  outcomes: { status: number; data?: unknown }[],
  captured: CapturedCall[],
): AxiosAdapter => async (cfg: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  captured.push({
    ...(cfg.url !== undefined ? { url: cfg.url } : {}),
    params: cfg.params,
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
  await setToken('google', 'accessToken', 'g_access_test');
  __setHttpClientForTests(createNexusApiClient());
});

afterAll(() => {
  __setHttpClientForTests(null);
});

describe('listCalendarEvents', () => {
  it('rejects malformed timeMinIso / timeMaxIso without making any API call', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([], captured);
    __setHttpClientForTests(c);

    const r1 = await listCalendarEvents({
      timeMinIso: 'not-a-date',
      timeMaxIso: '2030-01-02T00:00:00.000Z',
    });
    expect(r1.ok).toBe(false);

    const r2 = await listCalendarEvents({
      timeMinIso: '2030-01-01T00:00:00.000Z',
      timeMaxIso: 'also-bad',
    });
    expect(r2.ok).toBe(false);

    expect(captured).toHaveLength(0);
  });

  it('rejects when timeMax <= timeMin', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([], captured);
    __setHttpClientForTests(c);
    const r = await listCalendarEvents({
      timeMinIso: '2030-01-02T00:00:00.000Z',
      timeMaxIso: '2030-01-01T00:00:00.000Z',
    });
    expect(r.ok).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it('clamps limit to [1, 50] and sends the canonical Google Calendar params', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { items: [] } }],
      captured,
    );
    __setHttpClientForTests(c);

    await listCalendarEvents({
      timeMinIso: '2030-01-01T00:00:00.000Z',
      timeMaxIso: '2030-01-08T00:00:00.000Z',
      limit: 200,
    });
    expect(captured[0]?.url).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    expect(captured[0]?.params).toMatchObject({
      orderBy: 'startTime',
      singleEvents: 'true',
      timeMin: '2030-01-01T00:00:00.000Z',
      timeMax: '2030-01-08T00:00:00.000Z',
      maxResults: '50',
    });
  });

  it('shapes the response into CalendarEvent[] with htmlLink defaulting to null', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            items: [
              {
                id: 'e1',
                summary: 'A',
                start: { dateTime: '2030-01-01T10:00:00.000Z' },
                end: { dateTime: '2030-01-01T11:00:00.000Z' },
                htmlLink: 'https://calendar.google.com/event?eid=A',
              },
              {
                id: 'e2',
                summary: 'B',
                start: { date: '2030-01-02' },
                end: { date: '2030-01-03' },
              },
            ],
          },
        },
      ],
      [],
    );
    __setHttpClientForTests(c);
    const r = await listCalendarEvents({
      timeMinIso: '2030-01-01T00:00:00.000Z',
      timeMaxIso: '2030-01-08T00:00:00.000Z',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(2);
      expect(r.value[0]?.summary).toBe('A');
      expect(r.value[0]?.htmlLink).toBe('https://calendar.google.com/event?eid=A');
      expect(r.value[1]?.htmlLink).toBeNull();
    }
  });

  it('returns Err on a 5xx upstream response', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([{ status: 500 }], []);
    __setHttpClientForTests(c);
    const r = await listCalendarEvents({
      timeMinIso: '2030-01-01T00:00:00.000Z',
      timeMaxIso: '2030-01-08T00:00:00.000Z',
    });
    expect(r.ok).toBe(false);
  });
});
