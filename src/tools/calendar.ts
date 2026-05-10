/**
 * Google Calendar tools — list upcoming events.
 *
 * Read-only; no destructive variants in this round. Goes through
 * `apiClient.nexusRequest` so the bearer + 401 refresh paths apply.
 */

import { nexusRequest } from '../services/apiClient';
import type { JsonSchemaObject, NexusTool } from '../types/agent';
import { type Result, ok } from '../types/auth';
import type { NexusError } from '../types/auth';

interface CalendarApiEvent {
  readonly id: string;
  readonly summary?: string;
  readonly start?: { readonly dateTime?: string; readonly date?: string };
  readonly end?: { readonly dateTime?: string; readonly date?: string };
  readonly htmlLink?: string;
}
interface CalendarListResponse {
  readonly items?: readonly CalendarApiEvent[];
}

export interface CalendarEventSummary {
  readonly id: string;
  readonly summary: string;
  readonly start: string;
  readonly end: string;
  readonly htmlLink: string;
}

const CALENDAR_LIST_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Max number of upcoming events to return (1-25).',
      minimum: 1,
      maximum: 25,
    },
    timeMin: {
      type: 'string',
      description: 'ISO 8601 lower bound; defaults to "now".',
      maxLength: 64,
    },
  },
  required: [],
};

export const calendarListTool: NexusTool<readonly CalendarEventSummary[]> = {
  name: 'calendar_list',
  description: "Lists the user's upcoming Google Calendar events.",
  inputSchema: CALENDAR_LIST_SCHEMA,
  isDestructive: false,
  execute: async (input): Promise<Result<readonly CalendarEventSummary[], NexusError>> => {
    const limit = Math.max(1, Math.min(25, Number(input.limit ?? 10)));
    const timeMin = typeof input.timeMin === 'string' ? input.timeMin : new Date().toISOString();

    const list = await nexusRequest<CalendarListResponse>({
      method: 'GET',
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      provider: 'google',
      params: {
        timeMin,
        maxResults: limit,
        singleEvents: true,
        orderBy: 'startTime',
      },
    });
    if (!list.ok) return list;

    const items = list.value.items ?? [];
    const summaries: CalendarEventSummary[] = items.slice(0, limit).map((e) => ({
      id: e.id,
      summary: e.summary ?? '(no title)',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      htmlLink: e.htmlLink ?? '',
    }));
    return ok(summaries);
  },
};
