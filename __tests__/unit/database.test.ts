/**
 * Unit tests for src/db/database.ts.
 *
 * The expo-sqlite native module is stubbed by a tiny in-memory shim that
 * implements just enough of the API surface (`execAsync`, `getFirstAsync`,
 * `runAsync`, `getAllAsync`, `closeAsync`) for the bootstrap to drive its
 * forward-only migration pipeline.
 *
 * These tests pin three contracts:
 *   1. PRAGMAs run before any migration.
 *   2. Migrations advance `user_version` exactly once per target.
 *   3. `initializeDatabase()` is idempotent — second call returns the
 *      cached handle without re-running migrations.
 */

interface FakeDb {
  pragmas: string[];
  sqlBatches: string[];
  userVersion: number;
  closed: boolean;
  execAsync: (source: string) => Promise<void>;
  getFirstAsync: <T = unknown>(source: string) => Promise<T | null>;
  getAllAsync: <T = unknown>() => Promise<readonly T[]>;
  runAsync: () => Promise<{ readonly lastInsertRowId: number; readonly changes: number }>;
  closeAsync: () => Promise<void>;
}

const makeFakeDb = (): FakeDb => {
  const db: FakeDb = {
    pragmas: [],
    sqlBatches: [],
    userVersion: 0,
    closed: false,
    execAsync: async (source: string) => {
      const trimmed = source.trim();
      const versionMatch = /^PRAGMA\s+user_version\s*=\s*(\d+)\s*;?$/i.exec(trimmed);
      if (versionMatch && versionMatch[1] !== undefined) {
        db.userVersion = parseInt(versionMatch[1], 10);
        return;
      }
      if (/^PRAGMA\s/i.test(trimmed)) {
        db.pragmas.push(trimmed);
        return;
      }
      db.sqlBatches.push(trimmed);
    },
    getFirstAsync: async <T = unknown>(source: string): Promise<T | null> => {
      if (/PRAGMA\s+user_version/i.test(source)) {
        return { user_version: db.userVersion } as unknown as T;
      }
      return null;
    },
    getAllAsync: async <T = unknown>(): Promise<readonly T[]> => [],
    runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    closeAsync: async () => {
      db.closed = true;
    },
  };
  return db;
};

let lastDb: FakeDb | null = null;
let throwOnOpen = false;
let openCount = 0;

// IMPORTANT: this matches the production import path `expo-sqlite/next`
// and NOT the legacy `expo-sqlite`. The original mock targeted the wrong
// module path and silently masked the SDK 50 boot-failure bug fixed in
// this commit. Keeping both paths mocked is defensive in case future
// code drifts back to either import.
jest.mock('expo-sqlite/next', () => ({
  __esModule: true,
  openDatabaseAsync: async (_name: string) => {
    openCount += 1;
    if (throwOnOpen) throw new Error('sqlite open failed');
    lastDb = makeFakeDb();
    return lastDb;
  },
}));
jest.mock('expo-sqlite', () => ({ __esModule: true }));

// eslint-disable-next-line import/first
import {
  __internal,
  __resetForTests,
  __setDatabaseForTests,
  getDatabase,
  initializeDatabase,
} from '../../src/db/database';

beforeEach(() => {
  __resetForTests();
  lastDb = null;
  throwOnOpen = false;
  openCount = 0;
  jest.clearAllMocks();
});

describe('initializeDatabase', () => {
  it('opens the database with the expected name', async () => {
    const result = await initializeDatabase();
    expect(result.ok).toBe(true);
    expect(openCount).toBe(1);
    expect(__internal.DB_NAME).toBe('nexus.db');
  });

  it('applies WAL and foreign_keys pragmas before running migrations', async () => {
    await initializeDatabase();
    expect(lastDb).not.toBeNull();
    if (lastDb) {
      expect(lastDb.pragmas).toContain('PRAGMA journal_mode = WAL;');
      expect(lastDb.pragmas).toContain('PRAGMA foreign_keys = ON;');
      expect(lastDb.sqlBatches.length).toBeGreaterThan(0);
    }
  });

  it('runs every pending migration in order and advances user_version', async () => {
    await initializeDatabase();
    expect(lastDb).not.toBeNull();
    if (lastDb) {
      expect(lastDb.userVersion).toBe(__internal.CURRENT_SCHEMA_VERSION);
      expect(lastDb.sqlBatches.length).toBe(__internal.MIGRATIONS.length);
    }
  });

  it('is idempotent — second call returns the cached handle without reopening', async () => {
    const first = await initializeDatabase();
    const second = await initializeDatabase();
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.value).toBe(second.value);
    expect(openCount).toBe(1);
  });

  it('does NOT re-run migrations when a fresh handle has user_version already at current', async () => {
    const preMigratedDb = makeFakeDb();
    preMigratedDb.userVersion = __internal.CURRENT_SCHEMA_VERSION;
    __setDatabaseForTests(preMigratedDb);

    const result = await initializeDatabase();
    expect(result.ok).toBe(true);
    expect(preMigratedDb.sqlBatches.length).toBe(0);
  });

  it('returns Err with code UNKNOWN when the underlying open call throws', async () => {
    throwOnOpen = true;
    const result = await initializeDatabase();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN');
      expect(result.error.isRetryable).toBe(false);
    }
  });

  it('migration list is sorted strictly by version', () => {
    let prev = -1;
    for (const m of __internal.MIGRATIONS) {
      expect(m.version).toBeGreaterThan(prev);
      prev = m.version;
    }
  });
});

describe('getDatabase', () => {
  it('throws synchronously when called before initializeDatabase', () => {
    __resetForTests();
    expect(() => getDatabase()).toThrow(/initializeDatabase/);
  });

  it('returns the cached handle after initialization', async () => {
    await initializeDatabase();
    expect(() => getDatabase()).not.toThrow();
  });
});
