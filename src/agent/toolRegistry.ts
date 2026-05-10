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
import { type DriveDocContent, type DriveFile, type EmailDetail } from '../types/google';
import { type OpenAiToolDefinition } from '../types/agent';
import { NexusError, type Result } from '../types/auth';
import { type UserPreference } from '../db/preferencesRepo';

import * as gmail from '../tools/gmail';
import * as gcal from '../tools/googleCalendar';
import * as contacts from '../tools/contacts';
import * as drive from '../tools/drive';
import * as memory from '../tools/memory';
import * as whatsapp from '../tools/whatsapp';

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
type GmailSearchEntry = ToolEntryBase<gmail.GmailSearchParams, GmailReadRecentResult>;
type GmailReadEmailEntry = ToolEntryBase<gmail.GmailReadEmailParams, EmailDetail>;
type CalendarCreateEntry = ToolEntryBase<CalendarEventInput, GoogleCalendarCreateEventResult>;
type CalendarNextEntry = ToolEntryBase<Record<string, never>, CalendarEvent | null>;
type ContactsSearchEntry = ToolEntryBase<
  ContactsSearchParams,
  { matches: readonly ContactMatch[]; message?: string }
>;
type DriveListEntry = ToolEntryBase<drive.DriveListParams, { files: readonly DriveFile[] }>;
type DriveReadEntry = ToolEntryBase<drive.DriveReadParams, DriveDocContent>;
type RememberFactEntry = ToolEntryBase<memory.RememberFactParams, UserPreference>;
type RecallFactEntry = ToolEntryBase<memory.RecallFactParams, { key: string; value: string | null }>;
type ListMemoriesEntry = ToolEntryBase<
  Record<string, never>,
  { entries: readonly { key: string; value: string; category: string }[] }
>;
type WhatsAppSendEntry = ToolEntryBase<whatsapp.WhatsAppSendParams, whatsapp.WhatsAppSendResult>;

export type AnyToolEntry =
  | GmailReadEntry
  | GmailSendEntry
  | GmailSearchEntry
  | GmailReadEmailEntry
  | CalendarCreateEntry
  | CalendarNextEntry
  | ContactsSearchEntry
  | DriveListEntry
  | DriveReadEntry
  | RememberFactEntry
  | RecallFactEntry
  | ListMemoriesEntry
  | WhatsAppSendEntry;

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

const GMAIL_SEARCH: GmailSearchEntry = {
  name: 'gmail_search',
  isDestructive: false,
  parseParams: gmail.parseGmailSearchParams,
  execute: gmail.gmailSearch,
  summarize: () => 'Search Gmail',
  definition: {
    type: 'function',
    function: {
      name: 'gmail_search',
      description:
        "Searches the user's Gmail using Gmail search syntax (e.g. 'from:boss@x.com after:2025/01/01 has:attachment').",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Gmail search query.' },
          limit: { type: 'integer', description: 'Max results (default 5, max 10).' },
        },
        required: ['query'],
      },
    },
  },
};

const GMAIL_READ_EMAIL: GmailReadEmailEntry = {
  name: 'gmail_read_email',
  isDestructive: false,
  parseParams: gmail.parseGmailReadEmailParams,
  execute: gmail.gmailReadEmail,
  summarize: () => 'Read a specific email by id',
  definition: {
    type: 'function',
    function: {
      name: 'gmail_read_email',
      description:
        'Reads the full body of a single Gmail message by its id. Use after gmail_read_recent or gmail_search returns the id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Gmail message id.' } },
        required: ['id'],
      },
    },
  },
};

const DRIVE_LIST: DriveListEntry = {
  name: 'drive_list_recent',
  isDestructive: false,
  parseParams: drive.parseDriveListParams,
  execute: drive.driveListRecent,
  summarize: () => 'List recent Drive files',
  definition: {
    type: 'function',
    function: {
      name: 'drive_list_recent',
      description: "Lists the user's recently modified Google Drive files.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Number of files (default 10, max 20).' },
          query: {
            type: 'string',
            description:
              "Optional Drive query syntax (e.g. \"name contains 'roadmap'\", \"mimeType='application/vnd.google-apps.document'\").",
          },
        },
        required: [],
      },
    },
  },
};

const DRIVE_READ: DriveReadEntry = {
  name: 'drive_read_doc',
  isDestructive: false,
  parseParams: drive.parseDriveReadParams,
  execute: drive.driveReadDoc,
  summarize: () => 'Read a Google Doc',
  definition: {
    type: 'function',
    function: {
      name: 'drive_read_doc',
      description:
        'Exports a Google Doc as plain text. Body is truncated at 8k characters. Use after drive_list_recent returns a file id.',
      parameters: {
        type: 'object',
        properties: { file_id: { type: 'string', description: 'Drive file id.' } },
        required: ['file_id'],
      },
    },
  },
};

const REMEMBER_FACT: RememberFactEntry = {
  name: 'remember_fact',
  isDestructive: false,
  parseParams: memory.parseRememberFactParams,
  execute: memory.rememberFact,
  summarize: () => 'Save a memory',
  definition: {
    type: 'function',
    function: {
      name: 'remember_fact',
      description:
        "Stores a small fact in Nexus's local memory so future agent turns can reference it. Use sparingly — only for things the user explicitly asks to remember or that are clearly stable preferences.",
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Short snake_case identifier (e.g. wife_phone, email_tone).' },
          value: { type: 'string', description: 'The fact to remember.' },
          category: {
            type: 'string',
            enum: ['communication', 'contacts', 'behavior'],
            description: 'Category bucket; default behavior.',
          },
        },
        required: ['key', 'value'],
      },
    },
  },
};

const RECALL_FACT: RecallFactEntry = {
  name: 'recall_fact',
  isDestructive: false,
  parseParams: memory.parseRecallFactParams,
  execute: memory.recallFact,
  summarize: () => 'Recall a memory',
  definition: {
    type: 'function',
    function: {
      name: 'recall_fact',
      description: 'Reads a previously-stored memory by key. Returns null when not set.',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string', description: 'Memory key.' } },
        required: ['key'],
      },
    },
  },
};

const LIST_MEMORIES: ListMemoriesEntry = {
  name: 'list_memories',
  isDestructive: false,
  parseParams: memory.parseListMemoriesParams,
  execute: memory.listMemories,
  summarize: () => 'List all memories',
  definition: {
    type: 'function',
    function: {
      name: 'list_memories',
      description: 'Lists every memory currently stored in the local user_preferences table.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
};

const WHATSAPP_SEND: WhatsAppSendEntry = {
  name: 'whatsapp_send_message',
  isDestructive: true,
  parseParams: whatsapp.parseWhatsAppSendParams,
  execute: whatsapp.whatsAppSendMessage,
  summarize: whatsapp.summarizeWhatsAppSend,
  definition: {
    type: 'function',
    function: {
      name: 'whatsapp_send_message',
      description:
        'Sends a WhatsApp message via the user\'s installed WhatsApp app. ' +
        'Always confirm with the user first. If the user mentions a person by ' +
        'name, call system_contacts_search FIRST to resolve the phone number.',
      parameters: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description:
              'Recipient phone number in E.164 format (e.g. +919876543210). ' +
              'Common separators are tolerated and normalised.',
          },
          message: {
            type: 'string',
            description: 'Exact text body of the message. Max 4096 characters.',
          },
        },
        required: ['phoneNumber', 'message'],
      },
    },
  },
};

const ALL_ENTRIES: readonly AnyToolEntry[] = Object.freeze([
  GMAIL_READ,
  GMAIL_SEND,
  GMAIL_SEARCH,
  GMAIL_READ_EMAIL,
  CALENDAR_CREATE,
  CALENDAR_NEXT,
  CONTACTS_SEARCH,
  DRIVE_LIST,
  DRIVE_READ,
  REMEMBER_FACT,
  RECALL_FACT,
  LIST_MEMORIES,
  WHATSAPP_SEND,
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
