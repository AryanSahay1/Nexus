/**
 * Chat history repository — CRUD over the existing `chat_history` table
 * (declared in `src/db/schema.sql` and migrated by `src/db/database.ts`).
 *
 * Persists every message the agent loop produces so the user's
 * conversation survives across launches. Read-on-boot is wired into the
 * BootSequencer's `chat_history_hydrate` step.
 *
 * The schema (re-stated from schema.sql for the reader's convenience):
 *
 *   CREATE TABLE chat_history (
 *     id            INTEGER PRIMARY KEY AUTOINCREMENT,
 *     role          TEXT    NOT NULL CHECK (role IN ('system','user','assistant','tool')),
 *     content       TEXT    NOT NULL,
 *     tool_call_id  TEXT,
 *     tool_name     TEXT,
 *     created_at    INTEGER NOT NULL
 *   );
 */

import { type Message } from '../types/agent';
import { NexusError, type Result, err, ok } from '../types/auth';

import { type NexusDatabase, getDatabase } from './database';

interface ChatHistoryRow {
  readonly id: number;
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly tool_call_id: string | null;
  readonly tool_name: string | null;
  readonly created_at: number;
}

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

const rowToMessage = (row: ChatHistoryRow): Message => {
  // Tool-call messages on the assistant side carry a JSON-encoded tool_calls
  // array in the `content` column. We don't need to deserialize that here;
  // chatStore consumers only render the role + plain content + optional tool
  // metadata, and the agent loop rebuilds tool_calls only from in-memory state.
  const base = {
    role: row.role,
    content: row.content,
  };
  if (row.role === 'tool') {
    return {
      ...base,
      role: 'tool' as const,
      ...(row.tool_call_id !== null ? { toolCallId: row.tool_call_id } : {}),
      ...(row.tool_name !== null ? { toolName: row.tool_name } : {}),
    };
  }
  return base;
};

/** Load every message in chronological (insertion) order. */
export const listAll = async (): Promise<Result<Message[], NexusError>> =>
  wrapDb(async (db) => {
    const rows = await db.getAllAsync<ChatHistoryRow>(
      'SELECT id, role, content, tool_call_id, tool_name, created_at FROM chat_history ORDER BY id ASC;',
    );
    return rows.map(rowToMessage);
  }, 'failed to load chat history');

/** Load the most recent N messages, returned in chronological order. */
export const listRecent = async (
  limit: number,
): Promise<Result<Message[], NexusError>> => {
  const safe = Math.max(1, Math.min(1000, Math.floor(limit)));
  return wrapDb(async (db) => {
    const rows = await db.getAllAsync<ChatHistoryRow>(
      `SELECT id, role, content, tool_call_id, tool_name, created_at
         FROM chat_history
        ORDER BY id DESC
        LIMIT ?;`,
      safe,
    );
    return rows.map(rowToMessage).reverse();
  }, 'failed to load recent chat history');
};

/** Append a single message. Returns the assigned row id. */
export const append = async (msg: Message): Promise<Result<number, NexusError>> =>
  wrapDb(async (db) => {
    const result = await db.runAsync(
      `INSERT INTO chat_history (role, content, tool_call_id, tool_name, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      msg.role,
      msg.content,
      msg.toolCallId ?? null,
      msg.toolName ?? null,
      Date.now(),
    );
    return result.lastInsertRowId;
  }, 'failed to append chat message');

/** Append several messages in a single transaction-like sequence. */
export const appendMany = async (
  msgs: readonly Message[],
): Promise<Result<void, NexusError>> => {
  if (msgs.length === 0) return ok(undefined);
  return wrapDb(async (db) => {
    for (const m of msgs) {
      await db.runAsync(
        `INSERT INTO chat_history (role, content, tool_call_id, tool_name, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        m.role,
        m.content,
        m.toolCallId ?? null,
        m.toolName ?? null,
        Date.now(),
      );
    }
  }, 'failed to append chat messages');
};

/** Wipe the entire history. Used by the chatStore.clearHistory action. */
export const clear = async (): Promise<Result<void, NexusError>> =>
  wrapDb(async (db) => {
    await db.runAsync('DELETE FROM chat_history;');
  }, 'failed to clear chat history');

export const __internal = { rowToMessage };
