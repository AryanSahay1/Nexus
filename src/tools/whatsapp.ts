/**
 * WhatsApp tool — sends a message via deep link.
 *
 * Implementation notes:
 *   - We do NOT call the WhatsApp Business API. That requires Meta
 *     business approval and is out of scope. Instead the tool builds a
 *     `https://wa.me/<number>?text=<encoded>` URL and hands it to
 *     `Linking.openURL` — the user's installed WhatsApp app handles
 *     composition and the actual send. The user is in the loop twice:
 *     once via the Confirmation gate inside Nexus (LAW 4) and once again
 *     when WhatsApp itself opens the chat with the message pre-filled.
 *   - Phone numbers must be E.164 (`+91…`); we delegate the validation
 *     to `phoneNumber.normalizeToE164`. The exported `parseWhatsAppSendParams`
 *     normalises before validating so the LLM can pass either format.
 *   - Output is `Result<{ opened: boolean }, NexusError>`. `opened: true`
 *     means we successfully invoked Linking; the actual send happens inside
 *     WhatsApp and is outside Nexus's observability window.
 */

import { normalizeToE164 } from '../utils/phoneNumber';
import { NexusError, type Result, err, ok } from '../types/auth';
import { logEvent, logError } from '../utils/logger';

/**
 * Pluggable URL launcher. Defaults to React Native's `Linking.openURL` at
 * call time (lazy require) — that way `whatsapp.ts` can be imported from
 * non-RN test environments (e.g. agent.test.ts) without dragging in the
 * react-native module graph at module load.
 */
export interface LinkingShim {
  openURL: (url: string) => Promise<unknown>;
}

let linkingOverride: LinkingShim | null = null;

/** Test seam — replace the default react-native Linking with a stub. */
export const __setLinkingForTests = (impl: LinkingShim | null): void => {
  linkingOverride = impl;
};

const getLinking = (): LinkingShim => {
  if (linkingOverride !== null) return linkingOverride;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const rn = require('react-native') as { Linking: LinkingShim };
  return rn.Linking;
};

const MAX_MESSAGE_CHARS = 4096;

export interface WhatsAppSendParams {
  readonly phoneNumber: string;
  readonly message: string;
}

export interface WhatsAppSendResult {
  readonly opened: boolean;
  readonly url: string;
}

/**
 * Validate + normalise the LLM's raw arguments. Phone numbers come in
 * mixed formats; we accept anything `normalizeToE164` recognises.
 */
export const parseWhatsAppSendParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<WhatsAppSendParams, NexusError> => {
  const phone = raw.phoneNumber;
  const message = raw.message;
  if (typeof phone !== 'string' || phone.length === 0) {
    return err(new NexusError('INVALID_INPUT', 'phoneNumber is required.'));
  }
  if (typeof message !== 'string' || message.length === 0) {
    return err(new NexusError('INVALID_INPUT', 'message is required.'));
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return err(
      new NexusError(
        'INVALID_INPUT',
        `message must be at most ${MAX_MESSAGE_CHARS} characters.`,
      ),
    );
  }
  const normalised = normalizeToE164(phone);
  if (!normalised.ok) return normalised;
  return ok({ phoneNumber: normalised.value, message });
};

/** Build the wa.me URL from validated params. Exported for unit tests. */
export const buildWhatsAppUrl = (params: WhatsAppSendParams): string => {
  // wa.me wants the number digits-only with no leading `+`.
  const digits = params.phoneNumber.startsWith('+')
    ? params.phoneNumber.slice(1)
    : params.phoneNumber;
  const encoded = encodeURIComponent(params.message);
  return `https://wa.me/${digits}?text=${encoded}`;
};

/** Hand-shake with WhatsApp via Linking. Never throws — Result-typed. */
export const whatsAppSendMessage = async (
  params: WhatsAppSendParams,
): Promise<Result<WhatsAppSendResult, NexusError>> => {
  const url = buildWhatsAppUrl(params);
  try {
    await getLinking().openURL(url);
    logEvent('whatsapp_send_opened', { provider: 'whatsapp' });
    return ok({ opened: true, url });
  } catch (cause) {
    logError('whatsapp_send_open_failed', { provider: 'whatsapp' });
    return err(
      new NexusError(
        'PROVIDER_ERROR',
        'Could not open WhatsApp. Is it installed?',
        { isRetryable: false, cause },
      ),
    );
  }
};

/** Human-readable summary used by the ConfirmationCard. */
export const summarizeWhatsAppSend = (params: WhatsAppSendParams): string =>
  `Send WhatsApp to ${params.phoneNumber}`;
