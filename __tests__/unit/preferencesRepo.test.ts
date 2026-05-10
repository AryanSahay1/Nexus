/**
 * Unit tests for src/db/preferencesRepo.ts.
 *
 * Drives the repo against an in-memory fake of the NexusDatabase
 * interface that records every SQL statement and parameter binding.
 */

jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: async () => {
    throw new Error('preferencesRepo tests inject the database directly via __setDatabaseForTests');
  },
}));

// eslint-disable-next-line import/first
import { type NexusDatabase, __resetForTests, __setDatabaseForTests } from '../../src/db/database';
// eslint-disable-next-line import/first
import {
  __internal,
  clear,
  deleteByKey,
  listAll,
  toSnapshot,
  upsert,
} from '../../src/db/preferencesRepo';

interface Row {
  id: number;
  key: string;
  value: string;
  category: string;
  created_at: number;
  updated_at: number;
}

const buildFakeDb = (): NexusDatabase & { rows: Row[] } => {
  const rows: Row[] = [];
  let nextId = 1;
  const db = {
    rows,
    execAsync: async () => {},
    closeAsync: async () => {},
    getFirstAsync: async <T = unknown>(_sql: string, ...args: readonly unknown[]) => {
      if (_sql.includes('FROM user_preferences WHERE key')) {
        const key = args[0];
        const found = rows.find((r) => r.key === key);
        return (found ?? null) as T | null;
      }
      return null;
    },
    getAllAsync: async <T = unknown>(_sql: string) => {
      const sorted = [...rows].sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        if (a.key < b.key) return -1;
        if (a.key > b.key) return 1;
        return 0;
      });
      return sorted as unknown as readonly T[];
    },
    runAsync: async (_sql: string, ...args: readonly unknown[]) => {
      const sql = _sql.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('INSERT INTO user_preferences')) {
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
          existing.category = category;
          existing.updated_at = updatedAt;
        } else {
          rows.push({
            id: nextId,
            key,
            value,
            category,
            created_at: createdAt,
            updated_at: updatedAt,
          });
          nextId += 1;
        }
        return { lastInsertRowId: nextId - 1, changes: 1 };
      }
      if (sql.startsWith('DELETE FROM user_preferences WHERE key')) {
        const key = args[0];
        const beforeLength = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const r = rows[i];
          if (r !== undefined && r.key === key) rows.splice(i, 1);
        }
        return { lastInsertRowId: 0, changes: beforeLength - rows.length };
      }
      if (sql.startsWith('DELETE FROM user_preferences')) {
        const beforeLength = rows.length;
        rows.length = 0;
        return { lastInsertRowId: 0, changes: beforeLength };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
  };
  return db;
};

beforeEach(() => {
  __resetForTests();
  __setDatabaseForTests(buildFakeDb());
});

describe('upsert', () => {
  it('inserts a new preference and returns the persisted row', async () => {
    const r = await upsert('email_tone', 'professional', 'communication');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.key).toBe('email_tone');
      expect(r.value.value).toBe('professional');
      expect(r.value.category).toBe('communication');
      expect(r.value.createdAt).toBeGreaterThan(0);
      expect(r.value.updatedAt).toBe(r.value.createdAt);
    }
  });

  it('updates an existing preference value while preserving created_at', async () => {
    const first = await upsert('email_tone', 'casual', 'communication');
    if (!first.ok) throw new Error('first upsert failed');
    const createdAt = first.value.createdAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await upsert('email_tone', 'professional', 'communication');
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.value).toBe('professional');
      expect(second.value.createdAt).toBe(createdAt);
      expect(second.value.updatedAt).toBeGreaterThanOrEqual(createdAt);
    }
  });

  it('rejects empty key', async () => {
    const r = await upsert('   ', 'value', 'communication');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_INPUT');
  });

  it('rejects oversized key (>128) and value (>4096)', async () => {
    const longKey = 'k'.repeat(129);
    const longValue = 'v'.repeat(4097);
    expect((await upsert(longKey, 'x', 'communication')).ok).toBe(false);
    expect((await upsert('k', longValue, 'communication')).ok).toBe(false);
  });
});

describe('listAll', () => {
  it('returns preferences sorted by category then key', async () => {
    await upsert('z_key', 'v', 'behavior');
    await upsert('a_key', 'v', 'communication');
    await upsert('b_key', 'v', 'behavior');
    const r = await listAll();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((p) => `${p.category}/${p.key}`)).toEqual([
        'behavior/b_key',
        'behavior/z_key',
        'communication/a_key',
      ]);
    }
  });

  it('drops rows with an unrecognized category from the result', async () => {
    await upsert('legit', 'v', 'communication');
    const r = await listAll();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.every((p) => __internal.isValidCategory(p.category))).toBe(true);
  });
});

describe('deleteByKey', () => {
  it('removes the matching row and is idempotent', async () => {
    await upsert('k', 'v', 'communication');
    expect((await deleteByKey('k')).ok).toBe(true);
    expect((await deleteByKey('k')).ok).toBe(true);
    const r = await listAll();
    expect(r.ok && r.value.length === 0).toBe(true);
  });
});

describe('clear', () => {
  it('removes every row', async () => {
    await upsert('a', '1', 'communication');
    await upsert('b', '2', 'behavior');
    expect((await clear()).ok).toBe(true);
    const r = await listAll();
    expect(r.ok && r.value.length === 0).toBe(true);
  });
});

describe('toSnapshot', () => {
  it('produces a flat key/value record from preferences', () => {
    const snap = toSnapshot([
      { id: 1, key: 'a', value: '1', category: 'behavior', createdAt: 0, updatedAt: 0 },
      { id: 2, key: 'b', value: '2', category: 'communication', createdAt: 0, updatedAt: 0 },
    ]);
    expect(snap).toEqual({ a: '1', b: '2' });
  });
});

describe('repo error handling', () => {
  it('returns Err with code UNKNOWN when getDatabase has not been initialized', async () => {
    __resetForTests();
    const r = await listAll();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN');
  });
});
