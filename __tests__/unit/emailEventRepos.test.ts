/**
 * Unit tests for src/db/emailRepository.ts and src/db/eventRepository.ts.
 *
 * Both repositories use the same NexusDatabase fake. Tests prove:
 *   - replaceAll / replaceInRange are atomic (clear-then-insert)
 *   - listAll / listInRange respect the documented ordering + filters
 *   - clear truly empties the table
 *   - missing-database (programmer error) yields a typed Err
 */

jest.mock('expo-sqlite/next', () => ({ __esModule: true, openDatabaseAsync: async () => null }));
jest.mock('expo-sqlite', () => ({ __esModule: true }));

// eslint-disable-next-line import/first
import {
  __resetForTests as resetDb,
  __setDatabaseForTests,
  type NexusDatabase,
} from '../../src/db/database';
// eslint-disable-next-line import/first
import * as emailRepository from '../../src/db/emailRepository';
// eslint-disable-next-line import/first
import * as eventRepository from '../../src/db/eventRepository';
// eslint-disable-next-line import/first
import { type GmailMessageSummary } from '../../src/types/tools';
// eslint-disable-next-line import/first
import { type CalendarEvent } from '../../src/types/tools';

interface AnyRow {
  [k: string]: unknown;
}

const buildFakeDb = (): NexusDatabase => {
  const tables: Record<string, AnyRow[]> = {
    cached_emails: [],
    cached_events: [],
  };

  const matchTable = (sql: string): string | null => {
    if (sql.includes('cached_emails')) return 'cached_emails';
    if (sql.includes('cached_events')) return 'cached_events';
    return null;
  };

  const filterByRange = (
    rows: AnyRow[],
    args: readonly unknown[],
  ): AnyRow[] => {
    const [from, to] = args as [string, string];
    return rows.filter(
      (r) => typeof r.start_iso === 'string' && r.start_iso >= from && r.start_iso < to,
    );
  };

  const sortByStart = (rows: AnyRow[]): AnyRow[] =>
    rows.slice().sort((a, b) => String(a.start_iso).localeCompare(String(b.start_iso)));

  const sortByCachedDesc = (rows: AnyRow[]): AnyRow[] =>
    rows.slice().sort((a, b) => Number(b.cached_at) - Number(a.cached_at));

  return {
    execAsync: async () => {},
    closeAsync: async () => {},
    getFirstAsync: async <T = unknown>() => null as T | null,
    getAllAsync: async <T = unknown>(sql: string, ...args: readonly unknown[]) => {
      const trimmed = sql.replace(/\s+/g, ' ').trim();
      const tbl = matchTable(trimmed);
      if (!tbl) return [] as unknown as readonly T[];
      let rows = tables[tbl] ?? [];
      if (trimmed.includes('WHERE start_iso')) rows = filterByRange(rows, args);
      if (trimmed.includes('ORDER BY start_iso ASC')) rows = sortByStart(rows);
      else if (trimmed.includes('ORDER BY cached_at DESC')) rows = sortByCachedDesc(rows);
      return rows as unknown as readonly T[];
    },
    runAsync: async (sql: string, ...args: readonly unknown[]) => {
      const trimmed = sql.replace(/\s+/g, ' ').trim();
      const tbl = matchTable(trimmed);
      if (!tbl) return { lastInsertRowId: 0, changes: 0 };
      const list = tables[tbl];
      if (!list) return { lastInsertRowId: 0, changes: 0 };

      if (trimmed.startsWith('DELETE FROM cached_emails;')) {
        const before = list.length;
        list.length = 0;
        return { lastInsertRowId: 0, changes: before };
      }
      if (trimmed.startsWith('DELETE FROM cached_events WHERE start_iso')) {
        const [from, to] = args as [string, string];
        let removed = 0;
        for (let i = list.length - 1; i >= 0; i -= 1) {
          const r = list[i];
          if (r && typeof r.start_iso === 'string' && r.start_iso >= from && r.start_iso < to) {
            list.splice(i, 1);
            removed += 1;
          }
        }
        return { lastInsertRowId: 0, changes: removed };
      }
      if (trimmed.startsWith('DELETE FROM cached_events;')) {
        const before = list.length;
        list.length = 0;
        return { lastInsertRowId: 0, changes: before };
      }
      if (trimmed.startsWith('INSERT OR REPLACE INTO cached_emails')) {
        const [id, thread_id, sender, subject, snippet, date_iso, unread, cached_at] = args as [
          string, string, string, string, string, string | null, number, number,
        ];
        const idx = list.findIndex((r) => r.id === id);
        const row = { id, thread_id, sender, subject, snippet, date_iso, unread, cached_at };
        if (idx >= 0) list[idx] = row;
        else list.push(row);
        return { lastInsertRowId: 0, changes: 1 };
      }
      if (trimmed.startsWith('INSERT OR REPLACE INTO cached_events')) {
        const [id, summary, start_iso, end_iso, html_link, cached_at] = args as [
          string, string, string, string, string | null, number,
        ];
        const idx = list.findIndex((r) => r.id === id);
        const row = { id, summary, start_iso, end_iso, html_link, cached_at };
        if (idx >= 0) list[idx] = row;
        else list.push(row);
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
  };
};

beforeEach(() => {
  resetDb();
  __setDatabaseForTests(buildFakeDb());
});

describe('emailRepository', () => {
  const sample = (id: string, dateIso: string | null): GmailMessageSummary => ({
    id,
    threadId: `t_${id}`,
    from: `sender_${id}@example.com`,
    subject: `Subject ${id}`,
    snippet: `snippet ${id}`,
    dateIso,
  });

  it('replaceAll wipes prior cache then inserts the new batch', async () => {
    await emailRepository.replaceAll([sample('a', '2030-01-01T00:00:00.000Z')]);
    await emailRepository.replaceAll([
      sample('b', '2030-02-01T00:00:00.000Z'),
      sample('c', '2030-03-01T00:00:00.000Z'),
    ]);
    const r = await emailRepository.listAll();
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ids = r.value.map((m) => m.id).sort();
      expect(ids).toEqual(['b', 'c']);
      expect(r.value.find((m) => m.id === 'a')).toBeUndefined();
    }
  });

  it('replaceAll on empty array empties the cache', async () => {
    await emailRepository.replaceAll([sample('a', null)]);
    const r1 = await emailRepository.replaceAll([]);
    expect(r1.ok).toBe(true);
    const list = await emailRepository.listAll();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value).toEqual([]);
  });

  it('clear empties the cache', async () => {
    await emailRepository.replaceAll([sample('a', null), sample('b', null)]);
    const c = await emailRepository.clear();
    expect(c.ok).toBe(true);
    const list = await emailRepository.listAll();
    expect(list.ok && list.value.length === 0).toBe(true);
  });

  it('returns Err with code UNKNOWN when getDatabase has not been initialized', async () => {
    resetDb();
    const r = await emailRepository.listAll();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN');
  });
});

describe('eventRepository', () => {
  const event = (id: string, startIso: string, endIso: string): CalendarEvent => ({
    id,
    summary: `Event ${id}`,
    startIso,
    endIso,
    htmlLink: null,
  });

  it('replaceInRange only touches events within the window', async () => {
    // First seed two events: one inside, one outside the upcoming range.
    await eventRepository.replaceInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-02T00:00:00.000Z',
      events: [event('a', '2030-01-01T10:00:00.000Z', '2030-01-01T11:00:00.000Z')],
    });
    await eventRepository.replaceInRange({
      fromIso: '2030-02-01T00:00:00.000Z',
      toIso: '2030-02-02T00:00:00.000Z',
      events: [event('b', '2030-02-01T10:00:00.000Z', '2030-02-01T11:00:00.000Z')],
    });

    // Refresh the Jan window with a different content; b stays untouched.
    await eventRepository.replaceInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-02T00:00:00.000Z',
      events: [event('c', '2030-01-01T15:00:00.000Z', '2030-01-01T16:00:00.000Z')],
    });

    const jan = await eventRepository.listInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-02T00:00:00.000Z',
    });
    const feb = await eventRepository.listInRange({
      fromIso: '2030-02-01T00:00:00.000Z',
      toIso: '2030-02-02T00:00:00.000Z',
    });
    expect(jan.ok && jan.value.map((e) => e.id)).toEqual(['c']);
    expect(feb.ok && feb.value.map((e) => e.id)).toEqual(['b']);
  });

  it('listInRange filters strictly by start_iso ∈ [fromIso, toIso)', async () => {
    await eventRepository.replaceInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-02T00:00:00.000Z',
      events: [
        event('a', '2030-01-01T00:00:00.000Z', '2030-01-01T01:00:00.000Z'),
        event('b', '2030-01-01T23:59:59.000Z', '2030-01-02T00:30:00.000Z'),
      ],
    });
    const r = await eventRepository.listInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-02T00:00:00.000Z',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('clear empties the table', async () => {
    await eventRepository.replaceInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-08T00:00:00.000Z',
      events: [event('a', '2030-01-02T10:00:00.000Z', '2030-01-02T11:00:00.000Z')],
    });
    const c = await eventRepository.clear();
    expect(c.ok).toBe(true);
    const list = await eventRepository.listInRange({
      fromIso: '2030-01-01T00:00:00.000Z',
      toIso: '2030-01-08T00:00:00.000Z',
    });
    expect(list.ok && list.value.length === 0).toBe(true);
  });
});
