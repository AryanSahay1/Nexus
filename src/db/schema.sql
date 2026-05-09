-- Project Nexus — local SQLite schema (expo-sqlite)
--
-- Strict invariants:
--   * Single writer (the app) — no multi-tenant or sync concerns.
--   * Schema migrations are forward-only, tracked via PRAGMA user_version.
--   * Tokens, API keys, and OAuth state are NEVER stored here. SecureStore only.
--   * All timestamps are stored as INTEGER (Unix ms since epoch) to keep
--     comparisons trivial across SQLite drivers.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- user_preferences
-- Free-form user-managed key/value pairs that get injected into every
-- system prompt by src/agent/systemPrompt.ts.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- chat_history
-- Persisted conversation. The agent loop reads this to reconstruct
-- conversational context. Tool results are stored verbatim because they may
-- contain sensitive data — the schema relies on SQLite full-disk encryption
-- (iOS Data Protection) and never leaves the device.
-- ---------------------------------------------------------------------------
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
