/**
 * emailRepository — local cache of Gmail thread summaries (schema v2
 * `cached_emails` table).
 *
 * Powers the Mail screen's offline-first behavior. The screen reads
 * `listAll()` on mount and renders immediately; in parallel it fires a
 * network refresh via gmailService.listGmailMessages and calls
 * `replaceAll()` once the network result arrives. If the device is
 * offline the user still sees their most recent fetched view rather
 * than an empty error screen.
 *
 * Everything is best-effort. A cache failure is logged but never
 * propagated as a user-facing error — the network call remains the
 * authoritative source of truth.
 */

import { type GmailMessageSummary } from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';

import { type NexusDatabase, getDatabase } from './database';

interface CachedEmailRow {
  readonly id: string;
  readonly thread_id: string;
  readonly sender: string;
  readonly subject: string;
  readonly snippet: string;
  readonly date_iso: string | null;
  readonly unread: number;
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

const rowToSummary = (row: CachedEmailRow): GmailMessageSummary => ({
  id: row.id,
  threadId: row.thread_id,
  from: row.sender,
  subject: row.subject,
  snippet: row.snippet,
  dateIso: row.date_iso,
});

/** Read every cached email summary, newest-cached-first. */
export const listAll = async (): Promise<Result<GmailMessageSummary[], NexusError>> =>
  wrapDb(async (db) => {
    const rows = await db.getAllAsync<CachedEmailRow>(
      'SELECT id, thread_id, sender, subject, snippet, date_iso, unread, cached_at FROM cached_emails ORDER BY cached_at DESC LIMIT 200;',
    );
    return rows.map(rowToSummary);
  }, 'failed to list cached emails');

/**
 * Replace the entire cache with a freshly-fetched batch from the
 * network. Performed inside a single SQLite transaction-like sequence
 * so the cache never sits half-updated.
 */
export const replaceAll = async (
  summaries: readonly GmailMessageSummary[],
): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync('DELETE FROM cached_emails;');
    if (summaries.length === 0) return;
    const cachedAt = Date.now();
    for (const s of summaries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_emails
         (id, thread_id, sender, subject, snippet, date_iso, unread, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        s.id,
        s.threadId,
        s.from,
        s.subject,
        s.snippet,
        s.dateIso,
        0,
        cachedAt,
      );
    }
  }, 'failed to replace cached emails');

/** Wipe — used by Settings → factory reset. */
export const clear = async (): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync('DELETE FROM cached_emails;');
  }, 'failed to clear cached emails');

export const __internal = { rowToSummary };
