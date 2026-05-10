/**
 * Google Workspace data shapes.
 *
 * These mirror only what the agent loop and UI actually consume — not the
 * full Gmail / Calendar / Drive API surface. Every field is required or
 * explicitly nullable so consumers never have to write defensive optional
 * chaining beyond what the types demand.
 */

// ── Gmail ──────────────────────────────────────────────────────────────────

/** Light-weight thread summary returned by listing endpoints. */
export interface EmailThread {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly snippet: string;
  readonly dateIso: string | null;
  readonly unread: boolean;
}

/** Full email body (already decoded from base64url + MIME-walked). */
export interface EmailDetail {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly dateIso: string | null;
  readonly bodyText: string;
}

/** Outbound email payload (composed by the agent). */
export interface EmailDraft {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

// ── Calendar ───────────────────────────────────────────────────────────────

/** Re-exported here so screens have a single Google import surface. */
export type { CalendarEvent, CalendarEventInput } from './tools';

// ── Drive ──────────────────────────────────────────────────────────────────

/** A single Drive file as exposed by the API listing call. */
export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTimeIso: string | null;
  readonly webViewLink: string | null;
}

/**
 * Plain-text export of a Google Doc / Sheet / Slide content. Truncated by
 * the service to keep agent context small enough for the LLM window.
 */
export interface DriveDocContent {
  readonly fileId: string;
  readonly text: string;
  readonly truncated: boolean;
}
