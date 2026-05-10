/**
 * Tool registry — single source of truth for tool definitions.
 *
 * Every entry has:
 *   - `definition`: the OpenAI tool schema sent on the chat-completions request
 *   - `isDestructive`: drives the agent loop's confirmation gate (LAW 4)
 *   - `parseParams`: validator narrowing the LLM's raw arguments
 *   - `execute`: the typed executor that returns `Result<unknown, NexusError>`
 *   - `summarize`: human-readable string for the ConfirmationCard
 */

import {
  type ContactMatch,
  type ContactsSearchParams,
  type GmailReadRecentParams,
  type GmailReadRecentResult,
  type GmailSendEmailParams,
  type GmailSendEmailResult,
  type CalendarEventInput,
  type CalendarEvent,
  type GoogleCalendarCreateEventResult,
} from '../types/tools';
import { type OpenAiToolDefinition } from '../types/agent';
import { NexusError, type Result } from '../types/auth';

import * as gmail from '../tools/gmail';
import * as gcal from '../tools/googleCalendar';
import * as contacts from '../tools/contacts';

interface ToolEntryBase<P, R> {
  readonly name: string;
  readonly definition: OpenAiToolDefinition;
  readonly isDestructive: boolean;
  readonly parseParams: (raw: Readonly<Record<string, unknown>>) => Result<P, NexusError>;
  readonly execute: (params: P) => Promise<Result<R, NexusError>>;
  readonly summarize: (params: P) => string;
}

type GmailReadEntry = ToolEntryBase<GmailReadRecentParams, GmailReadRecentResult>;
type GmailSendEntry = ToolEntryBase<GmailSendEmailParams, GmailSendEmailResult>;
type CalendarCreateEntry = ToolEntryBase<CalendarEventInput, GoogleCalendarCreateEventResult>;
type CalendarNextEntry = ToolEntryBase<Record<string, never>, CalendarEvent | null>;
type ContactsSearchEntry = ToolEntryBase<
  ContactsSearchParams,
  { matches: readonly ContactMatch[]; message?: string }
>;

export type AnyToolEntry =
  | GmailReadEntry
  | GmailSendEntry
  | CalendarCreateEntry
  | CalendarNextEntry
  | ContactsSearchEntry;

const GMAIL_READ: GmailReadEntry = {
  name: 'gmail_read_recent',
  isDestructive: false,
  parseParams: gmail.parseGmailReadRecentParams,
  execute: gmail.gmailReadRecent,
  summarize: () => 'Read recent emails from Gmail',
  definition: {
    type: 'function',
    function: {
      name: 'gmail_read_recent',
      description:
        "Fetches the user's recent emails. Use when the user asks about their inbox, messages, or specific senders. Ask for clarification if the intent is vague.",
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Number of emails to retrieve (max 10). Default 5.',
          },
          query: {
            type: 'string',
            description:
              "Optional Gmail search syntax e.g. 'from:john@example.com is:unread'.",
          },
        },
        required: [],
      },
    },
  },
};

const GMAIL_SEND: GmailSendEntry = {
  name: 'gmail_send_email',
  isDestructive: true,
  parseParams: gmail.parseGmailSendEmailParams,
  execute: gmail.gmailSendEmail,
  summarize: gmail.summarizeSendEmail,
  definition: {
    type: 'function',
    function: {
      name: 'gmail_send_email',
      description:
        'Sends an email via Gmail. Always show the user the drafted email for confirmation before calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address.' },
          subject: { type: 'string', description: 'Email subject line.' },
          body: { type: 'string', description: 'Full email body text.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
};

const CALENDAR_CREATE: CalendarCreateEntry = {
  name: 'google_calendar_create_event',
  isDestructive: true,
  parseParams: gcal.parseCalendarCreateEventParams,
  execute: gcal.googleCalendarCreateEvent,
  summarize: gcal.summarizeCreateEvent,
  definition: {
    type: 'function',
    function: {
      name: 'google_calendar_create_event',
      description: "Creates a new event in the user's primary Google Calendar.",
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Event title.' },
          start_time: {
            type: 'string',
            description:
              'ISO 8601 start datetime e.g. 2025-06-15T14:00:00+05:30.',
          },
          end_time: { type: 'string', description: 'ISO 8601 end datetime.' },
          timezone: {
            type: 'string',
            description: "IANA timezone e.g. 'Asia/Kolkata'.",
          },
          attendees: {
            type: 'array',
            description: 'List of attendee email addresses.',
            items: { type: 'string' },
          },
          description: {
            type: 'string',
            description: 'Optional event description or agenda.',
          },
        },
        required: ['summary', 'start_time', 'end_time'],
      },
    },
  },
};

const CALENDAR_NEXT: CalendarNextEntry = {
  name: 'google_calendar_get_next',
  isDestructive: false,
  parseParams: () => ({ ok: true, value: {} }),
  execute: () => gcal.googleCalendarGetNext(),
  summarize: () => 'Read upcoming calendar events',
  definition: {
    type: 'function',
    function: {
      name: 'google_calendar_get_next',
      description: "Retrieves the user's next upcoming calendar event.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
};

const CONTACTS_SEARCH: ContactsSearchEntry = {
  name: 'system_contacts_search',
  isDestructive: false,
  parseParams: contacts.parseContactsSearchParams,
  execute: contacts.systemContactsSearch,
  summarize: () => 'Search the device address book',
  definition: {
    type: 'function',
    function: {
      name: 'system_contacts_search',
      description:
        "Searches the device's native contacts by name or relationship. Call this BEFORE any messaging tool when the user refers to a person by name.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              "Name or relationship to search e.g. 'brother', 'John Smith', 'mom'.",
          },
        },
        required: ['query'],
      },
    },
  },
};

const ALL_ENTRIES: readonly AnyToolEntry[] = Object.freeze([
  GMAIL_READ,
  GMAIL_SEND,
  CALENDAR_CREATE,
  CALENDAR_NEXT,
  CONTACTS_SEARCH,
]);

/** Return all tool definitions ready for the OpenAI request body. */
export const getOpenAiToolDefinitions = (): readonly OpenAiToolDefinition[] =>
  ALL_ENTRIES.map((e) => e.definition);

/** Look up an entry by name. Returns null on unknown name. */
export const getTool = (name: string): AnyToolEntry | null => {
  for (const entry of ALL_ENTRIES) {
    if (entry.name === name) return entry;
  }
  return null;
};

/** Used by sprint tests to assert registry invariants. */
export const __internal = { ALL_ENTRIES };
