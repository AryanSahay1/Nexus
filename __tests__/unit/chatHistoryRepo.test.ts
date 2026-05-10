/**
 * Unit tests for src/db/chatHistoryRepo.ts.
 *
 * The expo-sqlite native module is replaced with an in-memory fake that
 * mimics the subset of the API we actually depend on. We then use
 * __setDatabaseForTests to inject the fake, bypassing initializeDatabase.
 */

jest.mock('expo-sqlite', () => ({ __esModule: true }));

import { __setDatabaseForTests, __resetForTests, type NexusDatabase } from '../../src/db/database';
import {
  clearAllMessages,
  insertMessage,
  listAllMessages,
} from '../../src/db/chatHistoryRepo';

interface Row {
  id: number;
  role: string;
  content: string;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: number;
}

const buildFakeDatabase = (): {
  db: NexusDatabase;
  rows: Row[];
} => {
  const rows: Row[] = [];
  let nextId = 1;

  const db: NexusDatabase = {
    execAsync: async () => undefined,
    getFirstAsync: async () => null,
    getAllAsync: async <T = unknown>(): Promise<readonly T[]> =>
      rows.slice() as unknown as readonly T[],
    runAsync: async (
      source: string,
      ...args: readonly unknown[]
    ): Promise<{ lastInsertRowId: number; changes: number }> => {
      if (source.startsWith('INSERT')) {
        const [role, content, toolCallId, toolName, createdAt] = args as readonly [
          string,
          string,
          string | null,
          string | null,
          number,
        ];
        const id = nextId;
        nextId += 1;
        rows.push({
          id,
          role,
          content,
          tool_call_id: toolCallId,
          tool_name: toolName,
          created_at: createdAt,
        });
        return { lastInsertRowId: id, changes: 1 };
      }
      if (source.startsWith('DELETE')) {
        const removed = rows.length;
        rows.length = 0;
        return { lastInsertRowId: 0, changes: removed };
      }
      return { lastInsertRowId: 0, changes: 0 };
    },
    closeAsync: async () => undefined,
  };
  return { db, rows };
};

beforeEach(() => {
  __resetForTests();
});

describe('chatHistoryRepo', () => {
  it('insertMessage round-trips through SELECT', async () => {
    const { db } = buildFakeDatabase();
    __setDatabaseForTests(db);

    const inserted = await insertMessage({
      role: 'user',
      content: 'hello world',
    });
    expect(inserted.ok).toBe(true);

    const all = await listAllMessages();
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value).toHaveLength(1);
      expect(all.value[0]?.role).toBe('user');
      expect(all.value[0]?.content).toBe('hello world');
    }
  });

  it('insertMessage stores tool metadata when present', async () => {
    const { db } = buildFakeDatabase();
    __setDatabaseForTests(db);

    await insertMessage({
      role: 'tool',
      content: '{"messages":[]}',
      toolCallId: 'tc-1',
      toolName: 'gmail_read',
    });

    const all = await listAllMessages();
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value[0]?.toolCallId).toBe('tc-1');
      expect(all.value[0]?.toolName).toBe('gmail_read');
    }
  });

  it('clearAllMessages empties the table', async () => {
    const { db } = buildFakeDatabase();
    __setDatabaseForTests(db);

    await insertMessage({ role: 'user', content: 'a' });
    await insertMessage({ role: 'assistant', content: 'b' });
    const cleared = await clearAllMessages();
    expect(cleared.ok).toBe(true);
    const all = await listAllMessages();
    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value).toHaveLength(0);
  });

  it('returns Err when the underlying database throws on insert', async () => {
    const failing: NexusDatabase = {
      execAsync: async () => undefined,
      getFirstAsync: async () => null,
      getAllAsync: async () => [],
      runAsync: async () => {
        throw new Error('disk full');
      },
      closeAsync: async () => undefined,
    };
    __setDatabaseForTests(failing);

    const result = await insertMessage({ role: 'user', content: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN');
  });
});
