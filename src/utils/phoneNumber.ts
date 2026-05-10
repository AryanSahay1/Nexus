/**
 * Phone-number normalization.
 *
 * The contact-search tool returns numbers from the device address book in
 * arbitrary formats (e.g. "(415) 555-1234", "415.555.1234", "9876543210").
 * The WhatsApp / Twilio / etc. APIs all want strict E.164 (`+<countryCode>
 * <subscriber>`).
 *
 * This module is intentionally simple: it cleans separators, applies a
 * default country code if the user supplies one, and validates the
 * resulting string against the E.164 shape (`+`, 1-15 digits). It does
 * NOT attempt full libphonenumber-style country-aware parsing — that's
 * out of scope for Cycle One.
 */

import { NexusError, type Result, err, ok } from '../types/auth';

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

/** Strict E.164 validator. */
export const isValidE164 = (value: string): boolean => E164_PATTERN.test(value);

const stripSeparators = (raw: string): string => raw.replace(/[\s\-().]/g, '');

/**
 * Normalize a free-form phone-number string to E.164.
 *
 * - Removes whitespace, dashes, parens, dots.
 * - If the input already starts with `+`, validates and returns.
 * - If a `defaultCountryCode` is provided (e.g. `'+91'`) and the input
 *   does NOT start with `+`, the country code is prefixed.
 * - If neither condition produces a valid E.164, returns Err.
 */
export const normalizeToE164 = (
  raw: string,
  defaultCountryCode?: string,
): Result<string, NexusError> => {
  if (typeof raw !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'phone number must be a string.'));
  }
  const cleaned = stripSeparators(raw.trim());
  if (cleaned.length === 0) {
    return err(new NexusError('INVALID_INPUT', 'phone number cannot be empty.'));
  }
  let candidate: string;
  if (cleaned.startsWith('+')) {
    candidate = cleaned;
  } else if (typeof defaultCountryCode === 'string' && defaultCountryCode.length > 0) {
    const cc = defaultCountryCode.startsWith('+')
      ? defaultCountryCode
      : `+${defaultCountryCode}`;
    candidate = cc + cleaned.replace(/^0+/, '');
  } else {
    return err(
      new NexusError(
        'INVALID_INPUT',
        'phone number must start with "+" or be paired with a default country code.',
      ),
    );
  }
  if (!isValidE164(candidate)) {
    return err(new NexusError('INVALID_INPUT', `phone number "${raw}" is not valid E.164.`));
  }
  return ok(candidate);
};
