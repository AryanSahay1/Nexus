/**
 * Drive + Gmail get-by-id + Gmail search tests.
 *
 * Same stub-adapter pattern as googleService.test.ts, scoped to the
 * additions in the Marcus Vane build cycle.
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
  exportDriveDocAsText,
  getGmailMessage,
  listDriveFiles,
  searchGmailMessages,
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
}

const installAdapter = (
  outcomes: { status: number; data?: unknown }[],
  captured: CapturedCall[],
): AxiosAdapter => async (cfg: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  captured.push({
    ...(cfg.method !== undefined ? { method: cfg.method } : {}),
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

const b64url = (utf8: string): string =>
  Buffer.from(utf8, 'utf-8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

beforeEach(async () => {
  SecureStore.__reset();
  jest.clearAllMocks();
  await setToken('google', 'accessToken', 'g_access_test');
  __setHttpClientForTests(createNexusApiClient());
});

afterAll(() => {
  __setHttpClientForTests(null);
});

describe('getGmailMessage (full body)', () => {
  it('rejects an empty id without making a network call', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([], captured);
    __setHttpClientForTests(c);
    const r = await getGmailMessage('  ');
    expect(r.ok).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it('decodes a text/plain body from a single-part message', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            id: 'm1',
            threadId: 't1',
            internalDate: '1717200000000',
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'From', value: 'alice@example.com' },
                { name: 'To', value: 'me@example.com' },
                { name: 'Subject', value: 'Hi' },
                { name: 'Date', value: 'Mon, 1 Jun 2024 00:00:00 +0000' },
              ],
              body: { data: b64url('hello world') },
            },
          },
        },
      ],
      captured,
    );
    __setHttpClientForTests(c);

    const r = await getGmailMessage('m1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({
        id: 'm1',
        from: 'alice@example.com',
        to: 'me@example.com',
        subject: 'Hi',
        bodyText: 'hello world',
      });
      expect(r.value.dateIso).toBeDefined();
    }
    expect(captured[0]?.params).toEqual({ format: 'full' });
  });

  it('walks a multipart MIME tree to find text/plain', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            id: 'm2',
            threadId: 't2',
            internalDate: '1717200000000',
            payload: {
              mimeType: 'multipart/alternative',
              headers: [{ name: 'Subject', value: 'Multipart' }],
              parts: [
                { mimeType: 'text/html', body: { data: b64url('<b>html</b>') } },
                { mimeType: 'text/plain', body: { data: b64url('plaintext body') } },
              ],
            },
          },
        },
      ],
      [],
    );
    __setHttpClientForTests(c);
    const r = await getGmailMessage('m2');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.bodyText).toBe('plaintext body');
  });

  it('falls back to text/html with tags stripped when text/plain is absent', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            id: 'm3',
            threadId: 't3',
            payload: {
              mimeType: 'multipart/alternative',
              headers: [{ name: 'Subject', value: 'HTML only' }],
              parts: [
                { mimeType: 'text/html', body: { data: b64url('<p>Hello <b>World</b></p>') } },
              ],
            },
          },
        },
      ],
      [],
    );
    __setHttpClientForTests(c);
    const r = await getGmailMessage('m3');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.bodyText).toBe('Hello World');
  });

  it('returns an empty bodyText when no decodable body is present', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            id: 'm4',
            threadId: 't4',
            payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: 'Nothing' }] },
          },
        },
      ],
      [],
    );
    __setHttpClientForTests(c);
    const r = await getGmailMessage('m4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.bodyText).toBe('');
  });
});

describe('searchGmailMessages', () => {
  it('rejects an empty query', async () => {
    const r = await searchGmailMessages('');
    expect(r.ok).toBe(false);
  });

  it('passes the query through to listGmailMessages with the documented param shape', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { messages: [] } }],
      captured,
    );
    __setHttpClientForTests(c);
    await searchGmailMessages('from:boss@example.com is:unread', 3);
    expect(captured[0]?.params).toEqual({
      maxResults: '3',
      q: 'from:boss@example.com is:unread',
    });
  });
});

describe('listDriveFiles', () => {
  it('clamps limit to [1, 20] and shapes the result into DriveFile[]', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [
        {
          status: 200,
          data: {
            files: [
              {
                id: 'f1',
                name: 'Q3 plan',
                mimeType: 'application/vnd.google-apps.document',
                modifiedTime: '2024-06-01T00:00:00.000Z',
                webViewLink: 'https://docs.google.com/document/d/f1',
              },
            ],
          },
        },
      ],
      captured,
    );
    __setHttpClientForTests(c);

    const r = await listDriveFiles({ limit: 99 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual([
        {
          id: 'f1',
          name: 'Q3 plan',
          mimeType: 'application/vnd.google-apps.document',
          modifiedTimeIso: '2024-06-01T00:00:00.000Z',
          webViewLink: 'https://docs.google.com/document/d/f1',
        },
      ]);
    }
    expect(captured[0]?.url).toBe(`${__internal.DRIVE_BASE}/files`);
    expect(captured[0]?.params).toMatchObject({
      pageSize: '20',
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken',
      spaces: 'drive',
    });
  });

  it('passes through Drive search syntax in the q param', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: { files: [] } }],
      captured,
    );
    __setHttpClientForTests(c);
    await listDriveFiles({ limit: 5, query: "name contains 'roadmap'" });
    expect(captured[0]?.params).toMatchObject({ q: "name contains 'roadmap'" });
  });

  it('returns Err on upstream failure', async () => {
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([{ status: 500 }], []);
    __setHttpClientForTests(c);
    const r = await listDriveFiles({ limit: 5 });
    expect(r.ok).toBe(false);
  });
});

describe('exportDriveDocAsText', () => {
  it('rejects an empty file id without making a network call', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter([], captured);
    __setHttpClientForTests(c);
    const r = await exportDriveDocAsText('');
    expect(r.ok).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it('returns the full text for short docs and truncated=false', async () => {
    const captured: CapturedCall[] = [];
    const c = createNexusApiClient();
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: 'short text content' }],
      captured,
    );
    __setHttpClientForTests(c);
    const r = await exportDriveDocAsText('f1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.text).toBe('short text content');
      expect(r.value.truncated).toBe(false);
    }
    expect(captured[0]?.url).toBe(`${__internal.DRIVE_BASE}/files/f1/export`);
    expect(captured[0]?.params).toEqual({ mimeType: 'text/plain' });
  });

  it('truncates at DRIVE_DOC_MAX_CHARS for oversized docs', async () => {
    const c = createNexusApiClient();
    const huge = 'x'.repeat(__internal.DRIVE_DOC_MAX_CHARS + 100);
    c.defaults.adapter = installAdapter(
      [{ status: 200, data: huge }],
      [],
    );
    __setHttpClientForTests(c);
    const r = await exportDriveDocAsText('f2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.truncated).toBe(true);
      expect(r.value.text.length).toBe(__internal.DRIVE_DOC_MAX_CHARS);
    }
  });
});

describe('decoder helpers', () => {
  it('base64UrlDecode round-trips utf-8', () => {
    const enc = Buffer.from('hello — world', 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(__internal.base64UrlDecode(enc)).toBe('hello — world');
  });

  it('stripHtml removes tags + entities', () => {
    expect(__internal.stripHtml('<p>Hello&nbsp;<b>World</b></p>')).toBe('Hello World');
    expect(__internal.stripHtml('<style>x</style><p>Visible</p>')).toBe('Visible');
    expect(__internal.stripHtml('<script>alert(1)</script>visible')).toBe('visible');
  });
});

describe('logging hygiene (LAW 2)', () => {
  it('Drive listing failure never leaks the bearer token to console output', async () => {
    const log: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((m: unknown) => {
      log.push(String(m));
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation((m: unknown) => {
      log.push(String(m));
    });
    try {
      const c = createNexusApiClient();
      c.defaults.adapter = installAdapter([{ status: 500 }], []);
      __setHttpClientForTests(c);
      await listDriveFiles({ limit: 5 });
      const joined = log.join('\n');
      expect(joined).not.toContain('g_access_test');
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
