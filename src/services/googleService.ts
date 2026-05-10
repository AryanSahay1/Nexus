/**
 * Google service — Gmail (read + send) and Calendar (create + next).
 *
 * Every call goes through the shared apiClient with `nexusProvider: 'google'`
 * so:
 *   - the request interceptor injects the user's `accessToken` from
 *     SecureStore as the bearer
 *   - the response interceptor handles 401 → refresh-and-retry exactly once
 *
 * This module is a pure transport layer. Schema validation of LLM
 * arguments happens in `src/tools/*` before reaching here.
 */

import { type AxiosInstance } from 'axios';

import {
  type CalendarEvent,
  type CalendarEventInput,
  type GmailMessageSummary,
} from '../types/tools';
import { type DriveDocContent, type DriveFile, type EmailDetail } from '../types/google';
import { NexusError, type Result, err, ok } from '../types/auth';

import { apiClient as defaultClient, requestAsResult } from './apiClient';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_DOC_MAX_CHARS = 8000 as const;

let httpClient: AxiosInstance = defaultClient;
export const __setHttpClientForTests = (client: AxiosInstance | null): void => {
  httpClient = client ?? defaultClient;
};

// ── Gmail list -------------------------------------------------------------

interface GmailListResponse {
  readonly messages?: readonly { readonly id: string; readonly threadId: string }[];
  readonly nextPageToken?: string;
  readonly resultSizeEstimate?: number;
}

interface GmailMessageMetadata {
  readonly id: string;
  readonly threadId: string;
  readonly snippet?: string;
  readonly internalDate?: string;
  readonly payload?: {
    readonly headers?: readonly { readonly name: string; readonly value: string }[];
  };
}

const headerValue = (
  headers: readonly { readonly name: string; readonly value: string }[] | undefined,
  name: string,
): string => {
  if (!headers) return '';
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === lower) return h.value;
  }
  return '';
};

/**
 * List recent Gmail messages.
 *
 * Two-stage call:
 *   1. GET /messages?maxResults=&q=  → returns IDs only.
 *   2. for each ID, GET /messages/{id}?format=metadata&metadataHeaders=From,Subject,Date
 *      → returns trimmed metadata.
 *
 * `limit` is clamped to [1, 10] per PRD §5 (acceptance criterion 8).
 */
export const listGmailMessages = async (params: {
  readonly limit: number;
  readonly query?: string;
}): Promise<Result<GmailMessageSummary[], NexusError>> => {
  const limit = Math.max(1, Math.min(10, Math.floor(params.limit)));
  const queryParams: Record<string, string> = { maxResults: String(limit) };
  if (typeof params.query === 'string' && params.query.trim().length > 0) {
    queryParams.q = params.query.trim();
  }

  const list = await requestAsResult<GmailListResponse>(httpClient, {
    url: `${GMAIL_BASE}/messages`,
    method: 'GET',
    params: queryParams,
    nexusProvider: 'google',
  });
  if (!list.ok) return err(list.error);

  const ids = list.value.messages ?? [];
  const metas = await Promise.all(
    ids.map((m) =>
      requestAsResult<GmailMessageMetadata>(httpClient, {
        url: `${GMAIL_BASE}/messages/${m.id}`,
        method: 'GET',
        params: {
          format: 'metadata',
          metadataHeaders: 'From,Subject,Date',
        },
        nexusProvider: 'google',
      }),
    ),
  );

  const summaries: GmailMessageSummary[] = [];
  for (const meta of metas) {
    if (!meta.ok) return err(meta.error);
    const v = meta.value;
    const headers = v.payload?.headers;
    const dateHeader = headerValue(headers, 'Date');
    const internalMs = typeof v.internalDate === 'string' ? parseInt(v.internalDate, 10) : NaN;
    const dateIso =
      dateHeader.length > 0 && !Number.isNaN(Date.parse(dateHeader))
        ? new Date(Date.parse(dateHeader)).toISOString()
        : Number.isFinite(internalMs)
        ? new Date(internalMs).toISOString()
        : null;
    summaries.push({
      id: v.id,
      threadId: v.threadId,
      from: headerValue(headers, 'From'),
      subject: headerValue(headers, 'Subject'),
      snippet: v.snippet ?? '',
      dateIso,
    });
  }
  return ok(summaries);
};

// ── Gmail send -------------------------------------------------------------

const base64UrlEncode = (input: string): string => {
  const buf = Buffer.from(input, 'utf-8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/** Build an RFC 2822 compatible message payload. */
export const buildRfc2822 = (msg: {
  to: string;
  subject: string;
  body: string;
}): string => {
  const lines = [
    `To: ${msg.to}`,
    `Subject: ${msg.subject.replace(/\r?\n/g, ' ')}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    msg.body,
  ];
  return lines.join('\r\n');
};

/** Encode the RFC 2822 message into Gmail's `raw` base64url field. */
export const buildGmailRawPayload = (msg: {
  to: string;
  subject: string;
  body: string;
}): string => base64UrlEncode(buildRfc2822(msg));

interface GmailSendResponse {
  readonly id: string;
  readonly threadId: string;
}

/** POST /messages/send. */
export const sendGmailMessage = async (msg: {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}): Promise<Result<{ id: string; threadId: string }, NexusError>> => {
  if (msg.to.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'recipient email is required.'));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.to.trim())) {
    return err(new NexusError('INVALID_INPUT', 'recipient email is not a valid address.'));
  }
  return requestAsResult<GmailSendResponse>(httpClient, {
    url: `${GMAIL_BASE}/messages/send`,
    method: 'POST',
    data: { raw: buildGmailRawPayload(msg) },
    headers: { 'Content-Type': 'application/json' },
    nexusProvider: 'google',
  });
};

// ── Calendar create --------------------------------------------------------

interface CalendarCreateResponse {
  readonly id: string;
  readonly htmlLink?: string;
}

/** POST /calendar/v3/calendars/primary/events. */
export const createCalendarEvent = async (
  event: CalendarEventInput,
): Promise<Result<{ id: string; htmlLink: string | null }, NexusError>> => {
  if (event.summary.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'event summary is required.'));
  }
  if (Number.isNaN(Date.parse(event.startIso)) || Number.isNaN(Date.parse(event.endIso))) {
    return err(new NexusError('INVALID_INPUT', 'event start and end must be valid ISO 8601.'));
  }
  if (Date.parse(event.endIso) <= Date.parse(event.startIso)) {
    return err(new NexusError('INVALID_INPUT', 'event end must be after start.'));
  }

  const body: Record<string, unknown> = {
    summary: event.summary,
    start: {
      dateTime: event.startIso,
      ...(event.timezone ? { timeZone: event.timezone } : {}),
    },
    end: {
      dateTime: event.endIso,
      ...(event.timezone ? { timeZone: event.timezone } : {}),
    },
  };
  if (event.description) body.description = event.description;
  if (event.attendees && event.attendees.length > 0) {
    body.attendees = event.attendees.map((email) => ({ email }));
  }

  const response = await requestAsResult<CalendarCreateResponse>(httpClient, {
    url: `${CALENDAR_BASE}/calendars/primary/events`,
    method: 'POST',
    data: body,
    headers: { 'Content-Type': 'application/json' },
    nexusProvider: 'google',
  });
  if (!response.ok) return err(response.error);
  return ok({
    id: response.value.id,
    htmlLink: response.value.htmlLink ?? null,
  });
};

// ── Calendar next ----------------------------------------------------------

interface CalendarListResponse {
  readonly items?: readonly {
    readonly id: string;
    readonly summary?: string;
    readonly start?: { readonly dateTime?: string; readonly date?: string };
    readonly end?: { readonly dateTime?: string; readonly date?: string };
    readonly htmlLink?: string;
  }[];
}

/** GET upcoming events; returns the very next one or null. */
export const getNextCalendarEvent = async (
  now: Date = new Date(),
): Promise<Result<CalendarEvent | null, NexusError>> => {
  const response = await requestAsResult<CalendarListResponse>(httpClient, {
    url: `${CALENDAR_BASE}/calendars/primary/events`,
    method: 'GET',
    params: {
      orderBy: 'startTime',
      singleEvents: 'true',
      timeMin: now.toISOString(),
      maxResults: '1',
    },
    nexusProvider: 'google',
  });
  if (!response.ok) return err(response.error);
  const item = response.value.items?.[0];
  if (!item) return ok(null);
  const start = item.start?.dateTime ?? item.start?.date ?? '';
  const end = item.end?.dateTime ?? item.end?.date ?? '';
  return ok({
    id: item.id,
    summary: item.summary ?? '',
    startIso: start,
    endIso: end,
    htmlLink: item.htmlLink ?? null,
  });
};

// ── Gmail get-by-id (full body) -------------------------------------------

interface GmailFullMessage {
  readonly id: string;
  readonly threadId: string;
  readonly snippet?: string;
  readonly internalDate?: string;
  readonly payload?: GmailPart;
}

interface GmailPart {
  readonly mimeType?: string;
  readonly headers?: readonly { readonly name: string; readonly value: string }[];
  readonly body?: { readonly data?: string; readonly size?: number };
  readonly parts?: readonly GmailPart[];
}

/** RFC 4648 base64url -> utf-8 decoder. Tolerates missing padding. */
const base64UrlDecode = (b64url: string): string => {
  const padded = b64url + '='.repeat((4 - (b64url.length % 4)) % 4);
  const std = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(std, 'base64').toString('utf-8');
};

const stripHtml = (html: string): string =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/**
 * Walk a Gmail MIME tree to extract the most useful plain-text body.
 * Returns the empty string when no decodable body is found.
 */
const extractBody = (part: GmailPart | undefined): string => {
  if (!part) return '';
  // Prefer text/plain when present at any depth.
  const findByMime = (root: GmailPart, mime: string): string | null => {
    if (root.mimeType === mime && root.body?.data) {
      return base64UrlDecode(root.body.data);
    }
    if (root.parts) {
      for (const child of root.parts) {
        const found = findByMime(child, mime);
        if (found !== null) return found;
      }
    }
    return null;
  };
  const plain = findByMime(part, 'text/plain');
  if (plain !== null) return plain;
  const html = findByMime(part, 'text/html');
  if (html !== null) return stripHtml(html);
  if (part.body?.data) return base64UrlDecode(part.body.data);
  return '';
};

/** Read a single Gmail message by ID with the full decoded body. */
export const getGmailMessage = async (
  id: string,
): Promise<Result<EmailDetail, NexusError>> => {
  if (id.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'gmail message id is required.'));
  }
  const response = await requestAsResult<GmailFullMessage>(httpClient, {
    url: `${GMAIL_BASE}/messages/${encodeURIComponent(id.trim())}`,
    method: 'GET',
    params: { format: 'full' },
    nexusProvider: 'google',
  });
  if (!response.ok) return err(response.error);
  const v = response.value;
  const headers = v.payload?.headers;
  const findHeader = (name: string): string => {
    if (!headers) return '';
    const lower = name.toLowerCase();
    for (const h of headers) {
      if (h.name.toLowerCase() === lower) return h.value;
    }
    return '';
  };
  const dateHeader = findHeader('Date');
  const internalMs = typeof v.internalDate === 'string' ? parseInt(v.internalDate, 10) : NaN;
  const dateIso =
    dateHeader.length > 0 && !Number.isNaN(Date.parse(dateHeader))
      ? new Date(Date.parse(dateHeader)).toISOString()
      : Number.isFinite(internalMs)
      ? new Date(internalMs).toISOString()
      : null;
  return ok({
    id: v.id,
    threadId: v.threadId,
    from: findHeader('From'),
    to: findHeader('To'),
    subject: findHeader('Subject'),
    dateIso,
    bodyText: extractBody(v.payload),
  });
};

/** Search Gmail with arbitrary Gmail-style query syntax. */
export const searchGmailMessages = async (
  query: string,
  limit = 5,
): Promise<Result<GmailMessageSummary[], NexusError>> => {
  if (query.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'search query is required.'));
  }
  return listGmailMessages({ limit, query });
};

// ── Drive ---------------------------------------------------------------------

interface DriveListResponse {
  readonly files?: readonly {
    readonly id: string;
    readonly name: string;
    readonly mimeType: string;
    readonly modifiedTime?: string;
    readonly webViewLink?: string;
  }[];
  readonly nextPageToken?: string;
}

/** List recent Drive files, ordered by modifiedTime desc. */
export const listDriveFiles = async (params: {
  readonly limit?: number;
  readonly query?: string;
}): Promise<Result<DriveFile[], NexusError>> => {
  const limit = Math.max(1, Math.min(20, Math.floor(params.limit ?? 10)));
  const queryParams: Record<string, string> = {
    pageSize: String(limit),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken',
    spaces: 'drive',
  };
  if (typeof params.query === 'string' && params.query.trim().length > 0) {
    queryParams.q = params.query.trim();
  }

  const response = await requestAsResult<DriveListResponse>(httpClient, {
    url: `${DRIVE_BASE}/files`,
    method: 'GET',
    params: queryParams,
    nexusProvider: 'google',
  });
  if (!response.ok) return err(response.error);

  const files: DriveFile[] = (response.value.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTimeIso: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
  }));
  return ok(files);
};

/**
 * Export a Google Doc as plain text. Truncates to DRIVE_DOC_MAX_CHARS so the
 * returned content fits comfortably in the LLM context window.
 */
export const exportDriveDocAsText = async (
  fileId: string,
): Promise<Result<DriveDocContent, NexusError>> => {
  if (fileId.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'drive file id is required.'));
  }
  const response = await requestAsResult<string>(httpClient, {
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId.trim())}/export`,
    method: 'GET',
    params: { mimeType: 'text/plain' },
    responseType: 'text',
    transformResponse: [(data: unknown) => (typeof data === 'string' ? data : String(data))],
    nexusProvider: 'google',
  });
  if (!response.ok) return err(response.error);
  const raw = response.value ?? '';
  const truncated = raw.length > DRIVE_DOC_MAX_CHARS;
  return ok({
    fileId: fileId.trim(),
    text: truncated ? raw.slice(0, DRIVE_DOC_MAX_CHARS) : raw,
    truncated,
  });
};

export const __internal = {
  GMAIL_BASE,
  CALENDAR_BASE,
  DRIVE_BASE,
  DRIVE_DOC_MAX_CHARS,
  base64UrlEncode,
  base64UrlDecode,
  stripHtml,
  extractBody,
};
