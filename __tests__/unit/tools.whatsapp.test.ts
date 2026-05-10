/**
 * Unit tests for src/tools/whatsapp.ts.
 *
 * The WhatsApp tool is a thin Linking shim — the interesting surface is
 * the parameter validation + URL construction. The Linking module is
 * mocked to track invocations without crossing into native code.
 */

import {
  __setLinkingForTests,
  buildWhatsAppUrl,
  parseWhatsAppSendParams,
  summarizeWhatsAppSend,
  whatsAppSendMessage,
} from '../../src/tools/whatsapp';

const openURL = jest.fn();

beforeEach(() => {
  openURL.mockReset();
  __setLinkingForTests({ openURL });
});

afterAll(() => {
  __setLinkingForTests(null);
});

describe('parseWhatsAppSendParams', () => {
  it('accepts a strict E.164 number + a normal message', () => {
    const result = parseWhatsAppSendParams({
      phoneNumber: '+919876543210',
      message: 'Hello',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phoneNumber).toBe('+919876543210');
      expect(result.value.message).toBe('Hello');
    }
  });

  it('normalises a number with separators to E.164', () => {
    const result = parseWhatsAppSendParams({
      phoneNumber: '+1 (415) 555-1234',
      message: 'hi',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phoneNumber).toBe('+14155551234');
    }
  });

  it('rejects an invalid phone number with INVALID_INPUT', () => {
    const result = parseWhatsAppSendParams({
      phoneNumber: 'not-a-phone',
      message: 'hi',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a missing phoneNumber', () => {
    const result = parseWhatsAppSendParams({ message: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('phoneNumber');
  });

  it('rejects a missing message', () => {
    const result = parseWhatsAppSendParams({ phoneNumber: '+919876543210' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('message');
  });

  it('rejects an empty message', () => {
    const result = parseWhatsAppSendParams({
      phoneNumber: '+919876543210',
      message: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a message over 4096 characters', () => {
    const result = parseWhatsAppSendParams({
      phoneNumber: '+919876543210',
      message: 'x'.repeat(4097),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('4096');
  });
});

describe('buildWhatsAppUrl', () => {
  it('builds the canonical wa.me URL with URI-encoded message', () => {
    const url = buildWhatsAppUrl({
      phoneNumber: '+919876543210',
      message: 'hello, world!',
    });
    expect(url).toBe('https://wa.me/919876543210?text=hello%2C%20world!');
  });

  it('encodes line breaks and emoji safely', () => {
    const url = buildWhatsAppUrl({
      phoneNumber: '+14155551234',
      message: 'line1\nline2 ✨',
    });
    expect(url.startsWith('https://wa.me/14155551234?text=')).toBe(true);
    expect(url).toContain('%0A'); // encoded newline
    expect(url).not.toContain('\n'); // no raw newline
  });
});

describe('whatsAppSendMessage', () => {
  it('opens the URL via Linking and reports opened: true', async () => {
    openURL.mockResolvedValueOnce(undefined);
    const result = await whatsAppSendMessage({
      phoneNumber: '+919876543210',
      message: 'Hi there',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.opened).toBe(true);
      expect(result.value.url).toContain('wa.me/919876543210');
    }
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL.mock.calls[0]?.[0]).toBe(
      'https://wa.me/919876543210?text=Hi%20there',
    );
  });

  it('returns PROVIDER_ERROR when Linking.openURL throws (WhatsApp not installed)', async () => {
    openURL.mockRejectedValueOnce(new Error('No app to handle this URL'));
    const result = await whatsAppSendMessage({
      phoneNumber: '+919876543210',
      message: 'Hi',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.message).toMatch(/whatsapp/i);
    }
  });
});

describe('summarizeWhatsAppSend', () => {
  it('returns a human-readable string with the recipient phone', () => {
    const summary = summarizeWhatsAppSend({
      phoneNumber: '+919876543210',
      message: 'Hello',
    });
    expect(summary).toContain('+919876543210');
    expect(summary).toMatch(/whatsapp/i);
  });
});
