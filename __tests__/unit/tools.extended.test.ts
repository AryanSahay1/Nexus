/**
 * Unit tests for the new tools added in the Marcus Vane build cycle:
 *   - tools/memory  : remember_fact, recall_fact, list_memories
 *   - tools/drive   : drive_list_recent, drive_read_doc
 *   - tools/gmail   : gmail_search, gmail_read_email (param validators)
 *
 * Each tool's executor is also exercised through a stub backing layer
 * so we hit param-validation, dispatch, and error-mapping branches.
 */

import * as SecureStoreReal from 'expo-secure-store';

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

jest.mock('expo-sqlite', () => ({ __esModule: true, openDatabaseAsync: async () => null }));

// eslint-disable-next-line import/first
import { __resetForTests as resetDb, __setDatabaseForTests, type NexusDatabase } from '../../src/db/database';
// eslint-disable-next-line import/first
import { createPreferencesStore } from '../../src/store/preferencesStore';
// eslint-disable-next-line import/first
import {
  __resetForTests as resetMemory,
  installPreferencesStore,
  listMemories,
  parseListMemoriesParams,
  parseRecallFactParams,
  parseRememberFactParams,
  recallFact,
  rememberFact,
} from '../../src/tools/memory';
// eslint-disable-next-line import/first
import {
  driveListRecent,
  driveReadDoc,
  parseDriveListParams,
  parseDriveReadParams,
} from '../../src/tools/drive';
// eslint-disable-next-line import/first
import { parseGmailReadEmailParams, parseGmailSearchParams } from '../../src/tools/gmail';
// eslint-disable-next-line import/first
import * as googleService from '../../src/services/googleService';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

const buildFakeDb = (): NexusDatabase => {
  interface Row {
    id: number;
    key: string;
    value: string;
    category: string;
    created_at: number;
    updated_at: number;
  }
  const rows: Row[] = [];
  let nextId = 1;
  return {
    execAsync: async () => {},
    closeAsync: async () => {},
    getFirstAsync: async <T = unknown>(_sql: string, ...args: readonly unknown[]) => {
      if (_sql.includes('FROM user_preferences WHERE key')) {
        const k = args[0];
        const found = rows.find((r) => r.key === k);
        return (found ?? null) as T | null;
      }
      return null;
    },
    getAllAsync: async <T = unknown>() => rows.slice() as unknown as readonly T[],
    runAsync: async (sql: string, ...args: readonly unknown[]) => {
      const trimmed = sql.replace(/\s+/g, ' ').trim();
      if (trimmed.startsWith('INSERT INTO user_preferences')) {
        const [key, value, category, createdAt, updatedAt] = args as [
          string,
          string,
          string,
          number,
          number,
        ];
        const existing = rows.find((r) => r.key === key);
        if (existing) {
          existing.value = value;
          existing.updated_at = updatedAt;
        } else {
          rows.push({ id: nextId, key, value, category, created_at: createdAt, updated_at: updatedAt });
          nextId += 1;
        }
        return { lastInsertRowId: nextId - 1, changes: 1 };
      }
      if (trimmed.startsWith('DELETE FROM user_preferences WHERE key')) {
        const k = args[0];
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const r = rows[i];
          if (r !== undefined && r.key === k) rows.splice(i, 1);
        }
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
  };
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  resetDb();
  resetMemory();
});

// ── memory tools ----------------------------------------------------------

describe('memory tools', () => {
  beforeEach(() => {
    __setDatabaseForTests(buildFakeDb());
  });

  describe('parseRememberFactParams', () => {
    it('rejects missing key', () => {
      expect(parseRememberFactParams({ value: 'x' }).ok).toBe(false);
    });
    it('rejects non-string value', () => {
      expect(parseRememberFactParams({ key: 'k', value: 42 }).ok).toBe(false);
    });
    it('rejects an unknown category', () => {
      expect(parseRememberFactParams({ key: 'k', value: 'v', category: 'wrong' }).ok).toBe(false);
    });
    it('defaults missing category to behavior', () => {
      const r = parseRememberFactParams({ key: 'k', value: 'v' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.category).toBe('behavior');
    });
  });

  it('returns UNKNOWN when the preferences store has not been installed', async () => {
    const r = await rememberFact({ key: 'k', value: 'v', category: 'behavior' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN');
  });

  it('round-trips remember -> recall through the preferences store', async () => {
    const store = createPreferencesStore();
    installPreferencesStore(store);
    await store.getState().hydrateFromDb();
    const wrote = await rememberFact({ key: 'wife_phone', value: '+919876543210', category: 'contacts' });
    expect(wrote.ok).toBe(true);
    const read = await recallFact({ key: 'wife_phone' });
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.value).toBe('+919876543210');
  });

  it('recall_fact returns value=null for an unknown key', async () => {
    const store = createPreferencesStore();
    installPreferencesStore(store);
    await store.getState().hydrateFromDb();
    const r = await recallFact({ key: 'missing' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.value).toBeNull();
  });

  it('list_memories returns every entry in the store', async () => {
    const store = createPreferencesStore();
    installPreferencesStore(store);
    await store.getState().hydrateFromDb();
    await rememberFact({ key: 'a', value: '1', category: 'behavior' });
    await rememberFact({ key: 'b', value: '2', category: 'communication' });
    const r = await listMemories();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const keys = r.value.entries.map((e) => e.key).sort();
      expect(keys).toEqual(['a', 'b']);
    }
  });

  it('parseListMemoriesParams accepts any object', () => {
    expect(parseListMemoriesParams({ ignored: true }).ok).toBe(true);
  });

  it('parseRecallFactParams rejects empty key', () => {
    expect(parseRecallFactParams({ key: '' }).ok).toBe(false);
    expect(parseRecallFactParams({}).ok).toBe(false);
  });
});

// ── drive tools -----------------------------------------------------------

describe('drive tools — param validators', () => {
  it('parseDriveListParams floors fractional limit and accepts query', () => {
    const r = parseDriveListParams({ limit: 7.9, query: 'name contains "x"' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.limit).toBe(7);
      expect(r.value.query).toBe('name contains "x"');
    }
  });

  it('parseDriveListParams defaults limit to 10', () => {
    const r = parseDriveListParams({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.limit).toBe(10);
  });

  it('parseDriveListParams rejects non-string query', () => {
    expect(parseDriveListParams({ query: 42 }).ok).toBe(false);
  });

  it('parseDriveReadParams requires file_id', () => {
    expect(parseDriveReadParams({}).ok).toBe(false);
    expect(parseDriveReadParams({ file_id: '   ' }).ok).toBe(false);
    expect(parseDriveReadParams({ file_id: 'abc' }).ok).toBe(true);
  });
});

describe('drive tools — executors', () => {
  it('driveListRecent returns Err when the underlying service fails', async () => {
    const spy = jest
      .spyOn(googleService, 'listDriveFiles')
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: 'boom', isRetryable: true } as never,
      });
    try {
      const r = await driveListRecent({ limit: 5 });
      expect(r.ok).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('driveListRecent shapes the result as { files }', async () => {
    const spy = jest.spyOn(googleService, 'listDriveFiles').mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: 'f1',
          name: 'doc',
          mimeType: 'application/vnd.google-apps.document',
          modifiedTimeIso: null,
          webViewLink: null,
        },
      ],
    });
    try {
      const r = await driveListRecent({ limit: 5 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.files).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('driveReadDoc passes through to exportDriveDocAsText', async () => {
    const spy = jest.spyOn(googleService, 'exportDriveDocAsText').mockResolvedValueOnce({
      ok: true,
      value: { fileId: 'f1', text: 'body', truncated: false },
    });
    try {
      const r = await driveReadDoc({ fileId: 'f1' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.text).toBe('body');
    } finally {
      spy.mockRestore();
    }
  });
});

// ── gmail extended -------------------------------------------------------

describe('gmail extended — param validators', () => {
  it('parseGmailSearchParams requires non-empty query', () => {
    expect(parseGmailSearchParams({ query: '' }).ok).toBe(false);
    expect(parseGmailSearchParams({ query: '   ' }).ok).toBe(false);
  });

  it('parseGmailSearchParams floors fractional limits and defaults to 5', () => {
    const r1 = parseGmailSearchParams({ query: 'is:unread' });
    expect(r1.ok && r1.value.limit === 5).toBe(true);
    const r2 = parseGmailSearchParams({ query: 'is:unread', limit: 7.5 });
    expect(r2.ok && r2.value.limit === 7).toBe(true);
  });

  it('parseGmailReadEmailParams requires id', () => {
    expect(parseGmailReadEmailParams({}).ok).toBe(false);
    expect(parseGmailReadEmailParams({ id: 'abc' }).ok).toBe(true);
  });
});
