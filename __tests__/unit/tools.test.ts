/**
 * Unit tests for src/tools/{gmail,googleCalendar,contacts}.ts and
 * the phoneNumber utility they depend on.
 */

import * as SecureStoreReal from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
    __store: store,
  };
});

jest.mock('expo-sqlite', () => ({ __esModule: true, openDatabaseAsync: async () => null }));

// eslint-disable-next-line import/first
import { isValidE164, normalizeToE164 } from '../../src/utils/phoneNumber';
// eslint-disable-next-line import/first
import { parseGmailReadRecentParams, parseGmailSendEmailParams, summarizeSendEmail } from '../../src/tools/gmail';
// eslint-disable-next-line import/first
import { parseCalendarCreateEventParams, summarizeCreateEvent } from '../../src/tools/googleCalendar';
// eslint-disable-next-line import/first
import {
  __resetForTests,
  installContactsBackend,
  parseContactsSearchParams,
  setDefaultCountryCode,
  systemContactsSearch,
} from '../../src/tools/contacts';

const SecureStore = SecureStoreReal as unknown as typeof SecureStoreReal & {
  __reset: () => void;
};

beforeEach(() => {
  SecureStore.__reset();
  jest.clearAllMocks();
  __resetForTests();
});

// ── phoneNumber -----------------------------------------------------------

describe('phoneNumber', () => {
  it('isValidE164 accepts canonical strings', () => {
    expect(isValidE164('+919876543210')).toBe(true);
    expect(isValidE164('+14155551234')).toBe(true);
    expect(isValidE164('+442071838750')).toBe(true);
  });

  it('isValidE164 rejects bad shapes', () => {
    expect(isValidE164('919876543210')).toBe(false);
    expect(isValidE164('+0987654321')).toBe(false);
    expect(isValidE164('+abc')).toBe(false);
    expect(isValidE164('+1234567890123456')).toBe(false);
  });

  it('normalizeToE164 keeps a clean +-prefixed input', () => {
    const r = normalizeToE164('+91 98765 43210');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('+919876543210');
  });

  it('normalizeToE164 prefixes default country code when absent', () => {
    const r = normalizeToE164('(415) 555-1234', '+1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('+14155551234');
  });

  it('normalizeToE164 strips a leading 0 in trunk-style local numbers', () => {
    const r = normalizeToE164('09876543210', '+91');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('+919876543210');
  });

  it('normalizeToE164 returns Err when no plus and no default', () => {
    const r = normalizeToE164('9876543210');
    expect(r.ok).toBe(false);
  });

  it('normalizeToE164 returns Err for non-numeric trash', () => {
    expect(normalizeToE164('bobs-burgers').ok).toBe(false);
    expect(normalizeToE164('').ok).toBe(false);
  });
});

// ── gmail tool param validation ------------------------------------------

describe('gmail tool — param validators', () => {
  it('parseGmailReadRecentParams defaults limit to 5', () => {
    const r = parseGmailReadRecentParams({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.limit).toBe(5);
  });

  it('parseGmailReadRecentParams floors a fractional limit', () => {
    const r = parseGmailReadRecentParams({ limit: 7.9 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.limit).toBe(7);
  });

  it('parseGmailReadRecentParams rejects non-string query', () => {
    const r = parseGmailReadRecentParams({ query: 123 });
    expect(r.ok).toBe(false);
  });

  it('parseGmailSendEmailParams rejects missing required fields', () => {
    expect(parseGmailSendEmailParams({}).ok).toBe(false);
    expect(parseGmailSendEmailParams({ to: 'a@b.com' }).ok).toBe(false);
    expect(parseGmailSendEmailParams({ to: 'a@b.com', subject: 's' }).ok).toBe(false);
  });

  it('parseGmailSendEmailParams accepts a complete record', () => {
    const r = parseGmailSendEmailParams({ to: 'a@b.com', subject: 's', body: 'hi' });
    expect(r.ok).toBe(true);
  });

  it('summarizeSendEmail truncates long bodies for the confirmation card', () => {
    const summary = summarizeSendEmail({
      to: 'a@b.com',
      subject: 'Hi',
      body: 'x'.repeat(200),
    });
    expect(summary).toContain('Send email to a@b.com');
    expect(summary).toContain('...');
  });
});

// ── calendar tool param validation ---------------------------------------

describe('calendar tool — param validators', () => {
  it('parseCalendarCreateEventParams accepts a complete record', () => {
    const r = parseCalendarCreateEventParams({
      summary: 'Sync',
      start_time: '2030-01-01T10:00:00.000Z',
      end_time: '2030-01-01T11:00:00.000Z',
      timezone: 'Asia/Kolkata',
      attendees: ['a@b.com', 'c@d.com'],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.summary).toBe('Sync');
      expect(r.value.attendees).toEqual(['a@b.com', 'c@d.com']);
      expect(r.value.timezone).toBe('Asia/Kolkata');
    }
  });

  it('rejects malformed timestamps', () => {
    expect(
      parseCalendarCreateEventParams({
        summary: 'Sync',
        start_time: 'not-a-date',
        end_time: '2030-01-01T11:00:00.000Z',
      }).ok,
    ).toBe(false);
  });

  it('rejects non-string attendees', () => {
    expect(
      parseCalendarCreateEventParams({
        summary: 'Sync',
        start_time: '2030-01-01T10:00:00.000Z',
        end_time: '2030-01-01T11:00:00.000Z',
        attendees: ['a@b.com', 42],
      }).ok,
    ).toBe(false);
  });

  it('summarizeCreateEvent renders attendees when present', () => {
    const out = summarizeCreateEvent({
      summary: 'Sync',
      startIso: '2030-01-01T10:00:00.000Z',
      endIso: '2030-01-01T11:00:00.000Z',
      attendees: ['x@y.com'],
    });
    expect(out).toContain('Create calendar event "Sync"');
    expect(out).toContain('x@y.com');
  });
});

// ── contacts tool --------------------------------------------------------

describe('contacts tool', () => {
  it('parseContactsSearchParams rejects empty query', () => {
    expect(parseContactsSearchParams({}).ok).toBe(false);
    expect(parseContactsSearchParams({ query: '   ' }).ok).toBe(false);
  });

  it('returns PERMISSION_DENIED when the OS denies contacts access', async () => {
    installContactsBackend({
      requestPermission: async () => ({ granted: false }),
      getContacts: async () => {
        throw new Error('should not be called');
      },
    });
    const r = await systemContactsSearch({ query: 'Alice' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PERMISSION_DENIED');
  });

  it('returns up to 3 normalized matches when permission is granted', async () => {
    setDefaultCountryCode('+91');
    installContactsBackend({
      requestPermission: async () => ({ granted: true }),
      getContacts: async () => [
        {
          id: '1',
          name: 'Rahul (brother)',
          phoneNumbers: [{ number: '9876543210', label: 'mobile' }],
        },
        {
          id: '2',
          name: 'Rahul Mehta',
          phoneNumbers: [{ number: '+91 90000 11111' }],
        },
        {
          id: '3',
          name: 'Bob',
          phoneNumbers: [{ number: '+1 415-555-1234' }],
        },
      ],
    });
    const r = await systemContactsSearch({ query: 'Rahul' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.matches.map((m) => m.phoneNumber)).toEqual([
        '+919876543210',
        '+919000011111',
      ]);
    }
  });

  it('returns an empty matches array with a message when nothing matches', async () => {
    installContactsBackend({
      requestPermission: async () => ({ granted: true }),
      getContacts: async () => [{ id: '1', name: 'Alice', phoneNumbers: [] }],
    });
    const r = await systemContactsSearch({ query: 'Bob' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.matches).toEqual([]);
      expect(r.value.message).toContain('No contact found');
    }
  });

  it('drops malformed phone numbers from the result', async () => {
    installContactsBackend({
      requestPermission: async () => ({ granted: true }),
      getContacts: async () => [
        {
          id: '1',
          name: 'Alice',
          phoneNumbers: [
            { number: 'not-a-number' },
            { number: '+14155551234', label: 'work' },
          ],
        },
      ],
    });
    const r = await systemContactsSearch({ query: 'Alice' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.matches).toEqual([
        { name: 'Alice', phoneNumber: '+14155551234', label: 'work' },
      ]);
    }
  });
});
