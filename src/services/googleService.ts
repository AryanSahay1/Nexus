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
import { NexusError, type Result, err, ok } from '../types/auth';

import { apiClient as defaultClient, requestAsResult } from './apiClient';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

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

export const __internal = { GMAIL_BASE, CALENDAR_BASE, base64UrlEncode };
