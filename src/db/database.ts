/**
 * SQLite bootstrap for Project Nexus.
 *
 * Owns:
 *   - opening the single shared database connection
 *   - applying forward-only migrations tracked by `PRAGMA user_version`
 *   - exposing a tiny query helper for repository modules
 *
 * Repositories (e.g. preferencesRepo) consume `getDatabase()` to obtain the
 * shared handle. The init contract from app/_layout.tsx is:
 *
 *     const db = await initializeDatabase();
 *
 * Initialization is idempotent — calling it twice returns the same handle
 * and re-runs migrations only if user_version is behind.
 */

// IMPORTANT: SDK 50's default `expo-sqlite` export is the legacy WebSQL API
// (`openDatabase(name, version, ...)` returning a SQLiteDatabase with
// `transaction()`). The modern async surface — `openDatabaseAsync` plus
// `getFirstAsync` / `getAllAsync` / `runAsync` / `execAsync` directly on
// the database — lives at `expo-sqlite/next` until SDK 51 promotes it to
// the default. This file uses the next surface exclusively.
import * as SQLite from 'expo-sqlite/next';

import { NexusError, type Result, err, ok } from '../types/auth';
import { logError, logEvent } from '../utils/logger';

const DB_NAME = 'nexus.db' as const;
const CURRENT_SCHEMA_VERSION = 2 as const;

/**
 * Migrations are forward-only. Each entry is `[targetVersion, sqlBatch]`.
 * The SQL string can contain multiple statements separated by `;`.
 *
 * Keep this in lockstep with src/db/schema.sql — that file is the
 * authoritative human-readable reference; the strings below are what the
 * runtime actually executes.
 */
const MIGRATIONS: readonly { readonly version: number; readonly sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS user_preferences (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        key         TEXT    UNIQUE NOT NULL,
        value       TEXT    NOT NULL,
        category    TEXT    NOT NULL CHECK (category IN ('communication', 'contacts', 'behavior')),
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_user_preferences_category
        ON user_preferences (category);

      CREATE TABLE IF NOT EXISTS chat_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        role          TEXT    NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
        content       TEXT    NOT NULL,
        tool_call_id  TEXT,
        tool_name     TEXT,
        created_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_history_created_at
        ON chat_history (created_at);
    `,
  },
  {
    version: 2,
    sql: `
      -- Local cache of Gmail thread summaries. Powers offline-first
      -- rendering of the Mail screen — when the device has no network
      -- on launch, the most-recent fetched view is shown immediately
      -- and the network refresh runs in parallel.
      CREATE TABLE IF NOT EXISTS cached_emails (
        id            TEXT    PRIMARY KEY,
        thread_id     TEXT    NOT NULL,
        sender        TEXT    NOT NULL,
        subject       TEXT    NOT NULL,
        snippet       TEXT    NOT NULL,
        date_iso      TEXT,
        unread        INTEGER NOT NULL DEFAULT 0,
        cached_at     INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cached_emails_cached_at
        ON cached_emails (cached_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cached_emails_date_iso
        ON cached_emails (date_iso DESC);

      -- Local cache of Calendar events for offline-first rendering of
      -- the Calendar screen. Same offline-first contract as cached_emails.
      CREATE TABLE IF NOT EXISTS cached_events (
        id           TEXT    PRIMARY KEY,
        summary      TEXT    NOT NULL,
        start_iso    TEXT    NOT NULL,
        end_iso      TEXT    NOT NULL,
        html_link    TEXT,
        cached_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cached_events_start_iso
        ON cached_events (start_iso ASC);
    `,
  },
];

/**
 * Subset of the expo-sqlite API surface that this module depends on.
 * Capturing it explicitly makes the module trivially mockable in tests.
 */
export interface NexusDatabase {
  execAsync: (source: string) => Promise<void>;
  getFirstAsync: <T = unknown>(source: string, ...args: readonly unknown[]) => Promise<T | null>;
  getAllAsync: <T = unknown>(source: string, ...args: readonly unknown[]) => Promise<readonly T[]>;
  runAsync: (source: string, ...args: readonly unknown[]) => Promise<{ readonly lastInsertRowId: number; readonly changes: number }>;
  closeAsync: () => Promise<void>;
}

let cachedDb: NexusDatabase | null = null;

const openDatabase = async (): Promise<NexusDatabase> => {
  const surface = SQLite as unknown as {
    openDatabaseAsync?: (name: string) => Promise<NexusDatabase>;
  };
  if (typeof surface.openDatabaseAsync !== 'function') {
    throw new NexusError(
      'UNKNOWN',
      "expo-sqlite/next.openDatabaseAsync is not a function — wrong import or unsupported SDK.",
    );
  }
  return surface.openDatabaseAsync(DB_NAME);
};

const readUserVersion = async (db: NexusDatabase): Promise<number> => {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
};

const writeUserVersion = async (db: NexusDatabase, version: number): Promise<void> => {
  await db.execAsync(`PRAGMA user_version = ${version};`);
};

const applyPragmas = async (db: NexusDatabase): Promise<void> => {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
};

const runMigrations = async (db: NexusDatabase): Promise<void> => {
  const current = await readUserVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.execAsync(migration.sql);
    await writeUserVersion(db, migration.version);
    logEvent('db_migration_applied', { iteration: migration.version });
  }
};

/**
 * Open the shared database, apply pragmas, run migrations.
 * Safe to call multiple times.
 */
export const initializeDatabase = async (): Promise<Result<NexusDatabase, NexusError>> => {
  if (cachedDb !== null) return ok(cachedDb);
  try {
    const db = await openDatabase();
    await applyPragmas(db);
    await runMigrations(db);
    cachedDb = db;
    logEvent('db_initialized', { iteration: CURRENT_SCHEMA_VERSION });
    return ok(db);
  } catch (cause) {
    logError('db_init_failed', {});
    return err(
      new NexusError('UNKNOWN', 'Failed to initialize SQLite database.', {
        isRetryable: false,
        cause,
      }),
    );
  }
};

/**
 * Synchronous accessor used by repositories after init has completed.
 * Throws (synchronously) only if called before `initializeDatabase()` —
 * this is a programmer error, not a runtime condition.
 */
export const getDatabase = (): NexusDatabase => {
  if (cachedDb === null) {
    throw new NexusError('UNKNOWN', 'getDatabase() called before initializeDatabase().');
  }
  return cachedDb;
};

/** Test-only: reset module-level cache between tests. */
export const __resetForTests = (): void => {
  cachedDb = null;
};

/** Test-only: inject a pre-built database handle. */
export const __setDatabaseForTests = (db: NexusDatabase | null): void => {
  cachedDb = db;
};

export const __internal = { CURRENT_SCHEMA_VERSION, MIGRATIONS, DB_NAME };
