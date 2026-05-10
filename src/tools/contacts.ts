/**
 * Contacts tool — searches the device address book and returns top
 * matches with E.164-normalized phone numbers.
 *
 * The expo-contacts native module is injected via `installContactsBackend`
 * so unit tests can drive every code path (permission denial, no matches,
 * multiple matches, malformed numbers) without booting RN.
 */

import {
  type ContactMatch,
  type ContactsSearchParams,
  type ContactsSearchResult,
} from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';
import { normalizeToE164 } from '../utils/phoneNumber';

export interface ContactsBackend {
  requestPermission: () => Promise<{ granted: boolean }>;
  getContacts: () => Promise<readonly NativeContact[]>;
}

export interface NativeContact {
  readonly id: string;
  readonly name: string;
  readonly phoneNumbers?: readonly NativePhoneNumber[];
}

export interface NativePhoneNumber {
  readonly number: string;
  readonly label?: string | null;
}

let backend: ContactsBackend | null = null;
let defaultCountryCode: string | null = null;

export const installContactsBackend = (impl: ContactsBackend): void => {
  backend = impl;
};

/**
 * Set the default country code used to normalize device-stored numbers
 * that lack a leading `+`. This is set from the user's preferences at
 * boot (e.g. `default_country_code = '+91'`).
 */
export const setDefaultCountryCode = (code: string | null): void => {
  defaultCountryCode = code;
};

const MAX_RESULTS = 3;

/** Validate raw arguments from the LLM. */
export const parseContactsSearchParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<ContactsSearchParams, NexusError> => {
  const query = raw['query'];
  if (typeof query !== 'string' || query.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'contacts.search: query is required.'));
  }
  return ok({ query: query.trim() });
};

const matchesQuery = (name: string, query: string): boolean => {
  if (name.length === 0) return false;
  const haystack = name.toLowerCase();
  const needle = query.toLowerCase();
  return haystack.includes(needle);
};

/** Map raw native contacts to MaxResults E.164-normalized matches. */
const buildMatches = (
  contacts: readonly NativeContact[],
  query: string,
): ContactMatch[] => {
  const out: ContactMatch[] = [];
  for (const contact of contacts) {
    if (!matchesQuery(contact.name, query)) continue;
    const numbers = contact.phoneNumbers ?? [];
    for (const phone of numbers) {
      const normalized = normalizeToE164(
        phone.number,
        defaultCountryCode ?? undefined,
      );
      if (!normalized.ok) continue;
      out.push({
        name: contact.name,
        phoneNumber: normalized.value,
        label: phone.label ?? null,
      });
      if (out.length >= MAX_RESULTS) return out;
    }
    if (out.length >= MAX_RESULTS) return out;
  }
  return out;
};

export const systemContactsSearch = async (
  params: ContactsSearchParams,
): Promise<Result<ContactsSearchResult, NexusError>> => {
  if (backend === null) {
    return err(
      new NexusError('UNKNOWN', 'Contacts backend not installed.', { isRetryable: false }),
    );
  }
  const permission = await backend.requestPermission();
  if (!permission.granted) {
    return err(
      new NexusError('PERMISSION_DENIED', 'Contacts permission was denied by the user.', {
        isRetryable: false,
      }),
    );
  }
  const all = await backend.getContacts();
  const matches = buildMatches(all, params.query);
  return ok({
    matches,
    ...(matches.length === 0
      ? { message: `No contact found matching "${params.query}".` }
      : {}),
  });
};

export const __resetForTests = (): void => {
  backend = null;
  defaultCountryCode = null;
};
