/**
 * eventRepository — local cache of upcoming calendar events
 * (schema v2 `cached_events` table).
 *
 * Same offline-first contract as emailRepository: the Calendar screen
 * reads listInRange() on mount and renders immediately, then fires a
 * network refresh and calls replaceInRange() on the new result.
 */

import { type CalendarEvent } from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';

import { type NexusDatabase, getDatabase } from './database';

interface CachedEventRow {
  readonly id: string;
  readonly summary: string;
  readonly start_iso: string;
  readonly end_iso: string;
  readonly html_link: string | null;
  readonly cached_at: number;
}

const wrapDb = async <T>(
  fn: (db: NexusDatabase) => Promise<T>,
  errMessage: string,
): Promise<Result<T, NexusError>> => {
  let db: NexusDatabase;
  try {
    db = getDatabase();
  } catch (cause) {
    return err(new NexusError('UNKNOWN', errMessage, { isRetryable: false, cause }));
  }
  try {
    return ok(await fn(db));
  } catch (cause) {
    return err(new NexusError('UNKNOWN', errMessage, { isRetryable: true, cause }));
  }
};

const rowToEvent = (row: CachedEventRow): CalendarEvent => ({
  id: row.id,
  summary: row.summary,
  startIso: row.start_iso,
  endIso: row.end_iso,
  htmlLink: row.html_link,
});

/** List cached events whose start_iso falls in `[fromIso, toIso)`. */
export const listInRange = async (params: {
  readonly fromIso: string;
  readonly toIso: string;
}): Promise<Result<CalendarEvent[], NexusError>> =>
  wrapDb(async (db) => {
    const rows = await db.getAllAsync<CachedEventRow>(
      `SELECT id, summary, start_iso, end_iso, html_link, cached_at
         FROM cached_events
        WHERE start_iso >= ?
          AND start_iso <  ?
        ORDER BY start_iso ASC;`,
      params.fromIso,
      params.toIso,
    );
    return rows.map(rowToEvent);
  }, 'failed to list cached events');

/**
 * Replace cached events for a specific time window. Events outside
 * the window are preserved (so a single network refresh for
 * "next 7 days" doesn't wipe a separately-cached "next 30 days" page).
 */
export const replaceInRange = async (params: {
  readonly fromIso: string;
  readonly toIso: string;
  readonly events: readonly CalendarEvent[];
}): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync(
      `DELETE FROM cached_events WHERE start_iso >= ? AND start_iso < ?;`,
      params.fromIso,
      params.toIso,
    );
    if (params.events.length === 0) return;
    const cachedAt = Date.now();
    for (const e of params.events) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_events
         (id, summary, start_iso, end_iso, html_link, cached_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        e.id,
        e.summary,
        e.startIso,
        e.endIso,
        e.htmlLink,
        cachedAt,
      );
    }
  }, 'failed to replace cached events');

/** Wipe — used by Settings → factory reset. */
export const clear = async (): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync('DELETE FROM cached_events;');
  }, 'failed to clear cached events');

export const __internal = { rowToEvent };
