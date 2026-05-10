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

-- ---------------------------------------------------------------------------
-- cached_emails (schema v2)
-- Offline-first cache of Gmail thread summaries. The Mail screen reads
-- this table on mount before kicking off a network refresh, so the user
-- always sees their most recent fetched view immediately on launch.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- cached_events (schema v2)
-- Offline-first cache of upcoming calendar events. Same contract as
-- cached_emails: read on mount, refresh in background.
-- ---------------------------------------------------------------------------
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
