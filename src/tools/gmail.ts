/**
 * Tool executors for Gmail.
 *
 * Each function:
 *   1. validates raw arguments coming from the LLM (no `any` cast trust)
 *   2. calls the appropriate googleService function
 *   3. shapes the result into a string the LLM can read
 *
 * The `_param` validators are exported separately so the agent core's
 * tool dispatcher can re-use them ahead of executing.
 */

import * as googleService from '../services/googleService';
import {
  type GmailReadRecentParams,
  type GmailReadRecentResult,
  type GmailSendEmailParams,
  type GmailSendEmailResult,
} from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';

/** Validate the raw argument record from the LLM into typed params. */
export const parseGmailReadRecentParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<GmailReadRecentParams, NexusError> => {
  const limitRaw = raw['limit'];
  const queryRaw = raw['query'];
  let limit = 5;
  if (limitRaw !== undefined) {
    if (typeof limitRaw !== 'number' || !Number.isFinite(limitRaw)) {
      return err(new NexusError('INVALID_INPUT', 'gmail_read_recent: limit must be a number.'));
    }
    limit = Math.floor(limitRaw);
  }
  if (queryRaw !== undefined && typeof queryRaw !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'gmail_read_recent: query must be a string.'));
  }
  return ok({
    limit,
    ...(typeof queryRaw === 'string' && queryRaw.length > 0 ? { query: queryRaw } : {}),
  });
};

export const gmailReadRecent = async (
  params: GmailReadRecentParams,
): Promise<Result<GmailReadRecentResult, NexusError>> => {
  const result = await googleService.listGmailMessages(params);
  if (!result.ok) return err(result.error);
  return ok({ messages: result.value });
};

/** Validate raw send-email arguments. */
export const parseGmailSendEmailParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<GmailSendEmailParams, NexusError> => {
  const to = raw['to'];
  const subject = raw['subject'];
  const body = raw['body'];
  if (typeof to !== 'string' || to.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'gmail_send_email: "to" is required.'));
  }
  if (typeof subject !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'gmail_send_email: "subject" is required.'));
  }
  if (typeof body !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'gmail_send_email: "body" is required.'));
  }
  return ok({ to: to.trim(), subject, body });
};

export const gmailSendEmail = async (
  params: GmailSendEmailParams,
): Promise<Result<GmailSendEmailResult, NexusError>> => googleService.sendGmailMessage(params);

/** Human-readable summary for the ConfirmationCard before sending. */
export const summarizeSendEmail = (params: GmailSendEmailParams): string => {
  const subject = params.subject.length > 0 ? params.subject : '(no subject)';
  const preview = params.body.length > 80 ? `${params.body.slice(0, 77)}...` : params.body;
  return `Send email to ${params.to}\nSubject: ${subject}\n\n${preview}`;
};
