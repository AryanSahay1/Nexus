/**
 * Gmail tools — read recent / send message.
 *
 * Both go through `apiClient.nexusRequest` so the Bearer header, 401
 * refresh, and error mapping happen for free. The `gmail_send` tool is
 * `isDestructive: true`; the agent loop must route it through the
 * confirmation gate before calling `execute`.
 */

import { nexusRequest } from '../services/apiClient';
import type { JsonSchemaObject, NexusTool } from '../types/agent';
import { NexusError, type Result, err, ok } from '../types/auth';

// ── gmail_read ──────────────────────────────────────────────────────────

interface GmailMessageRef {
  readonly id: string;
  readonly threadId: string;
}
interface GmailListResponse {
  readonly messages?: readonly GmailMessageRef[];
}
interface GmailHeaderRow {
  readonly name: string;
  readonly value: string;
}
interface GmailMessageDetail {
  readonly id: string;
  readonly snippet?: string;
  readonly payload?: { readonly headers?: readonly GmailHeaderRow[] };
}

export interface GmailMessageSummary {
  readonly id: string;
  readonly from: string;
  readonly subject: string;
  readonly snippet: string;
}

const GMAIL_READ_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Number of emails to retrieve (1-10).',
      minimum: 1,
      maximum: 10,
    },
    query: {
      type: 'string',
      description: 'Optional Gmail search query (e.g. "from:alice is:unread").',
      maxLength: 256,
    },
  },
  required: [],
};

const headerValue = (
  headers: readonly GmailHeaderRow[] | undefined,
  name: string,
): string => headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

export const gmailReadTool: NexusTool<readonly GmailMessageSummary[]> = {
  name: 'gmail_read',
  description:
    "Fetches the user's recent emails. Use when the user asks about their inbox or a specific sender.",
  inputSchema: GMAIL_READ_SCHEMA,
  isDestructive: false,
  execute: async (input) => {
    const limit = Math.max(1, Math.min(10, Number(input.limit ?? 5)));
    const query = typeof input.query === 'string' ? input.query : undefined;

    const list = await nexusRequest<GmailListResponse>({
      method: 'GET',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      provider: 'google',
      params: { maxResults: limit, ...(query !== undefined ? { q: query } : {}) },
    });
    if (!list.ok) return list;

    const refs = (list.value.messages ?? []).slice(0, limit);
    const summaries: GmailMessageSummary[] = [];
    for (const ref of refs) {
      const detail = await nexusRequest<GmailMessageDetail>({
        method: 'GET',
        url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}`,
        provider: 'google',
        params: { format: 'metadata', metadataHeaders: 'From,Subject' },
      });
      if (!detail.ok) return detail;
      summaries.push({
        id: detail.value.id,
        from: headerValue(detail.value.payload?.headers, 'From'),
        subject: headerValue(detail.value.payload?.headers, 'Subject'),
        snippet: detail.value.snippet ?? '',
      });
    }
    return ok(summaries);
  },
};

// ── gmail_send ──────────────────────────────────────────────────────────

const GMAIL_SEND_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    to: {
      type: 'string',
      description: 'Recipient email address.',
      pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
      maxLength: 320,
    },
    subject: { type: 'string', description: 'Subject line.', maxLength: 200 },
    body: { type: 'string', description: 'Plain-text message body.', maxLength: 10_000 },
  },
  required: ['to', 'subject', 'body'],
};

export interface GmailSendResult {
  readonly id: string;
}

const base64UrlEncode = (input: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8').toString('base64url');
  }
  /* istanbul ignore next — exercised on-device */
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(input)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/u, '');
  }
  /* istanbul ignore next */
  throw new Error('No base64 encoder available.');
};

export const gmailSendTool: NexusTool<GmailSendResult> = {
  name: 'gmail_send',
  description:
    'Sends an email via Gmail. Always confirm with the user before triggering this tool.',
  inputSchema: GMAIL_SEND_SCHEMA,
  isDestructive: true,
  execute: async (input): Promise<Result<GmailSendResult, NexusError>> => {
    const to = String(input.to);
    const subject = String(input.subject);
    const body = String(input.body);

    const raw =
      `To: ${to}\r\n` +
      `Subject: ${subject}\r\n` +
      'MIME-Version: 1.0\r\n' +
      'Content-Type: text/plain; charset="UTF-8"\r\n' +
      '\r\n' +
      body;

    const send = await nexusRequest<{ readonly id: string }>({
      method: 'POST',
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      provider: 'google',
      body: { raw: base64UrlEncode(raw) },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!send.ok) return send;
    if (typeof send.value.id !== 'string' || send.value.id.length === 0) {
      return err(
        new NexusError('PROVIDER_ERROR', 'Gmail send response missing message id.'),
      );
    }
    return ok({ id: send.value.id });
  },
};
