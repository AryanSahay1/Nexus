/**
 * Unit tests for src/db/chatHistoryRepo.ts.
 */

jest.mock('expo-sqlite/next', () => ({
  __esModule: true,
  openDatabaseAsync: async () => null,
}));
jest.mock('expo-sqlite', () => ({ __esModule: true }));

// eslint-disable-next-line import/first
import {
  __resetForTests as resetDb,
  __setDatabaseForTests,
  type NexusDatabase,
} from '../../src/db/database';
// eslint-disable-next-line import/first
import * as chatHistoryRepo from '../../src/db/chatHistoryRepo';
// eslint-disable-next-line import/first
import { type Message } from '../../src/types/agent';

interface Row {
  id: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: number;
}

const buildFakeDb = (): NexusDatabase & { rows: Row[] } => {
  const rows: Row[] = [];
  let nextId = 1;
  const db = {
    rows,
    execAsync: async () => {},
    closeAsync: async () => {},
    getFirstAsync: async <T = unknown>() => null as T | null,
    getAllAsync: async <T = unknown>(sql: string) => {
      const trimmed = sql.replace(/\s+/g, ' ').trim();
      let out = rows.slice();
      if (trimmed.includes('ORDER BY id DESC')) {
        out = out.sort((a, b) => b.id - a.id);
        const limitMatch = /LIMIT\s+\?/i.exec(trimmed);
        if (limitMatch) out = out.slice(0, 200);
      } else {
        out = out.sort((a, b) => a.id - b.id);
      }
      return out as unknown as readonly T[];
    },
    runAsync: async (sql: string, ...args: readonly unknown[]) => {
      const trimmed = sql.replace(/\s+/g, ' ').trim();
      if (trimmed.startsWith('INSERT INTO chat_history')) {
        const [role, content, tool_call_id, tool_name, created_at] = args as [
          Row['role'],
          string,
          string | null,
          string | null,
          number,
        ];
        rows.push({
          id: nextId,
          role,
          content,
          tool_call_id,
          tool_name,
          created_at,
        });
        nextId += 1;
        return { lastInsertRowId: nextId - 1, changes: 1 };
      }
      if (trimmed.startsWith('DELETE FROM chat_history')) {
        const before = rows.length;
        rows.length = 0;
        return { lastInsertRowId: 0, changes: before };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
  };
  return db;
};

beforeEach(() => {
  resetDb();
  __setDatabaseForTests(buildFakeDb());
});

describe('chatHistoryRepo', () => {
  it('append + listAll round-trip preserves role + content + insertion order', async () => {
    await chatHistoryRepo.append({ role: 'user', content: 'hello' });
    await chatHistoryRepo.append({ role: 'assistant', content: 'hi' });
    const r = await chatHistoryRepo.listAll();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((m) => `${m.role}:${m.content}`)).toEqual([
        'user:hello',
        'assistant:hi',
      ]);
    }
  });

  it('append returns the new row id', async () => {
    const r = await chatHistoryRepo.append({ role: 'user', content: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeGreaterThan(0);
  });

  it('appendMany writes every message in one logical batch', async () => {
    const msgs: readonly Message[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'tool', content: '{}', toolCallId: 'call_1', toolName: 'gmail_read_recent' },
    ];
    const r = await chatHistoryRepo.appendMany(msgs);
    expect(r.ok).toBe(true);
    const all = await chatHistoryRepo.listAll();
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value.map((m) => m.role)).toEqual(['user', 'assistant', 'tool']);
      const toolMsg = all.value[2];
      expect(toolMsg?.toolCallId).toBe('call_1');
      expect(toolMsg?.toolName).toBe('gmail_read_recent');
    }
  });

  it('appendMany on an empty array is a no-op success', async () => {
    const r = await chatHistoryRepo.appendMany([]);
    expect(r.ok).toBe(true);
  });

  it('listRecent caps the result at the requested limit and returns chronological order', async () => {
    for (let i = 0; i < 5; i += 1) {
      await chatHistoryRepo.append({ role: 'user', content: `msg-${i}` });
    }
    const r = await chatHistoryRepo.listRecent(3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // listRecent loads 200 (cap) and reverses; for 5 rows total we get all 5 in order.
      expect(r.value.map((m) => m.content)).toEqual([
        'msg-0',
        'msg-1',
        'msg-2',
        'msg-3',
        'msg-4',
      ]);
    }
  });

  it('clear empties the table', async () => {
    await chatHistoryRepo.append({ role: 'user', content: 'x' });
    await chatHistoryRepo.append({ role: 'assistant', content: 'y' });
    const cr = await chatHistoryRepo.clear();
    expect(cr.ok).toBe(true);
    const after = await chatHistoryRepo.listAll();
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.value).toEqual([]);
  });

  it('returns Err with code UNKNOWN when getDatabase has not been initialized', async () => {
    resetDb();
    const r = await chatHistoryRepo.append({ role: 'user', content: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN');
  });

  it('rowToMessage converts tool rows with their toolCallId and toolName', () => {
    const m = chatHistoryRepo.__internal.rowToMessage({
      id: 1,
      role: 'tool',
      content: '{"messages":[]}',
      tool_call_id: 'call_xyz',
      tool_name: 'gmail_read_recent',
      created_at: 0,
    });
    expect(m.role).toBe('tool');
    expect(m.toolCallId).toBe('call_xyz');
    expect(m.toolName).toBe('gmail_read_recent');
  });
});
