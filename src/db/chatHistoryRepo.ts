/**
 * Chat history repository.
 *
 * Thin façade over the `chat_history` SQLite table created by the v1
 * migration. Used by the agent loop (to persist each turn) and the Memory
 * screen (to render conversations grouped by date).
 */

import { getDatabase } from './database';
import { NexusError, type Result, err, ok } from '../types/auth';
import { logError } from '../utils/logger';

export interface PersistedChatMessage {
  readonly id: number;
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCallId: string | null;
  readonly toolName: string | null;
  readonly createdAt: number;
}

export interface InsertChatMessageInput {
  readonly role: PersistedChatMessage['role'];
  readonly content: string;
  readonly toolCallId?: string | null;
  readonly toolName?: string | null;
}

interface ChatHistoryRow {
  readonly id: number;
  readonly role: PersistedChatMessage['role'];
  readonly content: string;
  readonly tool_call_id: string | null;
  readonly tool_name: string | null;
  readonly created_at: number;
}

const fromRow = (row: ChatHistoryRow): PersistedChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  toolCallId: row.tool_call_id,
  toolName: row.tool_name,
  createdAt: row.created_at,
});

export const insertMessage = async (
  message: InsertChatMessageInput,
): Promise<Result<PersistedChatMessage, NexusError>> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    const result = await db.runAsync(
      `INSERT INTO chat_history (role, content, tool_call_id, tool_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      message.role,
      message.content,
      message.toolCallId ?? null,
      message.toolName ?? null,
      now,
    );
    return ok({
      id: result.lastInsertRowId,
      role: message.role,
      content: message.content,
      toolCallId: message.toolCallId ?? null,
      toolName: message.toolName ?? null,
      createdAt: now,
    });
  } catch (cause) {
    logError('chat_history_insert_failed', { error_type: 'sqlite_insert' });
    return err(
      new NexusError('UNKNOWN', 'Failed to persist chat message.', { isRetryable: true, cause }),
    );
  }
};

export const listAllMessages = async (): Promise<Result<readonly PersistedChatMessage[], NexusError>> => {
  try {
    const db = getDatabase();
    const rows = await db.getAllAsync<ChatHistoryRow>(
      'SELECT id, role, content, tool_call_id, tool_name, created_at FROM chat_history ORDER BY id ASC',
    );
    return ok(rows.map(fromRow));
  } catch (cause) {
    logError('chat_history_list_failed', { error_type: 'sqlite_select' });
    return err(
      new NexusError('UNKNOWN', 'Failed to read chat history.', { isRetryable: true, cause }),
    );
  }
};

export const clearAllMessages = async (): Promise<Result<void, NexusError>> => {
  try {
    const db = getDatabase();
    await db.runAsync('DELETE FROM chat_history');
    return ok(undefined);
  } catch (cause) {
    logError('chat_history_clear_failed', { error_type: 'sqlite_delete' });
    return err(
      new NexusError('UNKNOWN', 'Failed to clear chat history.', { isRetryable: true, cause }),
    );
  }
};
