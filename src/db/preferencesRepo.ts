/**
 * Preferences repository — CRUD over the `user_preferences` table.
 *
 * Loaded by the preferences store at boot and consulted by the system
 * prompt builder on every agent turn. Every operation is wrapped in
 * Result<T, NexusError> per the directive's error-handling discipline.
 */

import { NexusError, type Result, err, ok } from '../types/auth';

import { type NexusDatabase, getDatabase } from './database';

export type PreferenceCategory = 'communication' | 'contacts' | 'behavior';

export interface UserPreference {
  readonly id: number;
  readonly key: string;
  readonly value: string;
  readonly category: PreferenceCategory;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface PreferenceRow {
  readonly id: number;
  readonly key: string;
  readonly value: string;
  readonly category: string;
  readonly created_at: number;
  readonly updated_at: number;
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'communication',
  'contacts',
  'behavior',
]);

const isValidCategory = (value: string): value is PreferenceCategory =>
  VALID_CATEGORIES.has(value);

const rowToPreference = (row: PreferenceRow): UserPreference | null => {
  if (!isValidCategory(row.category)) return null;
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const validateKeyValue = (key: string, value: string): Result<void, NexusError> => {
  if (key.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'preference key must be non-empty.'));
  }
  if (key.length > 128) {
    return err(new NexusError('INVALID_INPUT', 'preference key too long (max 128).'));
  }
  if (value.length > 4096) {
    return err(new NexusError('INVALID_INPUT', 'preference value too long (max 4096).'));
  }
  return ok(undefined);
};

const wrapDb = async <T>(
  fn: (db: NexusDatabase) => Promise<T>,
  errMessage: string,
): Promise<Result<T, NexusError>> => {
  let db: NexusDatabase;
  try {
    db = getDatabase();
  } catch (cause) {
    return err(
      new NexusError('UNKNOWN', errMessage, { isRetryable: false, cause }),
    );
  }
  try {
    return ok(await fn(db));
  } catch (cause) {
    return err(new NexusError('UNKNOWN', errMessage, { isRetryable: true, cause }));
  }
};

/** List every preference row, ordered by category then key. */
export const listAll = async (): Promise<Result<UserPreference[], NexusError>> =>
  wrapDb(async (db) => {
    const rows = await db.getAllAsync<PreferenceRow>(
      'SELECT id, key, value, category, created_at, updated_at FROM user_preferences ORDER BY category ASC, key ASC;',
    );
    const out: UserPreference[] = [];
    for (const row of rows) {
      const pref = rowToPreference(row);
      if (pref !== null) out.push(pref);
    }
    return out;
  }, 'failed to list preferences');

/**
 * Insert-or-update a preference by key. The `created_at` value is
 * preserved on update; `updated_at` is rewritten on every call.
 */
export const upsert = async (
  key: string,
  value: string,
  category: PreferenceCategory,
): Promise<Result<UserPreference, NexusError>> => {
  const validation = validateKeyValue(key, value);
  if (!validation.ok) return validation;

  return wrapDb(async (db) => {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO user_preferences (key, value, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         category = excluded.category,
         updated_at = excluded.updated_at;`,
      key,
      value,
      category,
      now,
      now,
    );
    const row = await db.getFirstAsync<PreferenceRow>(
      'SELECT id, key, value, category, created_at, updated_at FROM user_preferences WHERE key = ?;',
      key,
    );
    if (row === null) {
      throw new NexusError('UNKNOWN', 'upsert: row not found after insert.');
    }
    const pref = rowToPreference(row);
    if (pref === null) {
      throw new NexusError('UNKNOWN', 'upsert: returned row had invalid category.');
    }
    return pref;
  }, 'failed to upsert preference');
};

/** Delete a preference by key. Idempotent — no error if the row was absent. */
export const deleteByKey = async (key: string): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync('DELETE FROM user_preferences WHERE key = ?;', key);
  }, 'failed to delete preference');

/** Wipe every preference. */
export const clear = async (): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync('DELETE FROM user_preferences;');
  }, 'failed to clear preferences');

/** Snapshot as a flat key/value object — convenient for systemPrompt building. */
export const toSnapshot = (prefs: readonly UserPreference[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const p of prefs) out[p.key] = p.value;
  return out;
};

export const __internal = { rowToPreference, isValidCategory, validateKeyValue };
