/**
 * Secure token service.
 *
 * Single source of truth for reading, writing, and deleting credentials in
 * the device's secure enclave. Strict invariants:
 *
 *   - Only raw token strings are stored; never JSON blobs or objects.
 *   - Each (provider, tokenType) tuple maps to a unique SecureStore key
 *     using the pattern `nexus_<provider>_<tokenType>`.
 *   - All public functions return `Result<T, NexusError>` and never throw.
 *   - Tokens are NEVER logged, even at error level.
 *   - Bundle writes are atomic: either every field of an OAuth grant is
 *     persisted, or the provider is left fully cleared.
 *
 * SecureStore already encrypts at rest using Keychain (iOS) / Keystore
 * (Android) — adding a second encryption layer would only obscure the
 * threat model without improving security. See LAW 1, LAW 2, LAW 5.
 */

import * as SecureStore from 'expo-secure-store';

import {
  NexusError,
  type Provider,
  type Result,
  type SecureStoreKey,
  type ServiceConnection,
  type TokenType,
  type VaultSnapshot,
  err,
  ok,
} from '../types/auth';
import { logError, logEvent } from '../utils/logger';

const KEY_PREFIX = 'nexus' as const;
const ALL_PROVIDERS: readonly Provider[] = ['google', 'whatsapp', 'openai'];
const ALL_TOKEN_TYPES: readonly TokenType[] = [
  'accessToken',
  'refreshToken',
  'apiKey',
  'tokenExpiry',
  'userEmail',
  'clientId',
];

/**
 * iOS Keychain has a soft per-item limit of ~2KB. Above that, writes can
 * silently truncate or fail. This guard catches accidental attempts to
 * persist a JSON blob or oversized opaque token.
 */
const MAX_TOKEN_LENGTH = 2048;

/** Build the canonical SecureStore key for a given provider + token type. */
export const buildKey = (provider: Provider, tokenType: TokenType): SecureStoreKey =>
  `${KEY_PREFIX}_${provider}_${tokenType}` as SecureStoreKey;

/**
 * Validate a token string before writing to SecureStore.
 *
 * Rejects:
 *  - non-strings, empty strings, whitespace-only strings
 *  - oversized values (would exceed Keychain item limits)
 *  - obvious JSON blobs (LAW 5 — never persist parsed OAuth responses)
 */
const validateTokenValue = (value: unknown): Result<string, NexusError> => {
  if (typeof value !== 'string') {
    return err(new NexusError('INVALID_TOKEN_VALUE', 'Token value must be a string.'));
  }
  if (value.length === 0 || value.trim().length === 0) {
    return err(new NexusError('INVALID_TOKEN_VALUE', 'Token value must be non-empty.'));
  }
  if (value.length > MAX_TOKEN_LENGTH) {
    return err(
      new NexusError(
        'INVALID_TOKEN_VALUE',
        `Token value exceeds ${MAX_TOKEN_LENGTH} bytes; store individual fields separately.`,
      ),
    );
  }
  const trimmed = value.trim();
  const looksLikeJsonObject =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (looksLikeJsonObject) {
    return err(
      new NexusError(
        'INVALID_TOKEN_VALUE',
        'Refusing to persist JSON blob — parse and store individual fields (LAW 5).',
      ),
    );
  }
  return ok(value);
};

/**
 * Store a token string for a given provider + token type.
 * The value MUST be a raw string (e.g. accessToken). Never pass a JSON object.
 */
export const setToken = async (
  provider: Provider,
  tokenType: TokenType,
  value: string,
): Promise<Result<void, NexusError>> => {
  const validation = validateTokenValue(value);
  if (!validation.ok) return validation;

  const key = buildKey(provider, tokenType);
  try {
    await SecureStore.setItemAsync(key, validation.value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    logEvent('token_set', { provider, tool_name: tokenType });
    return ok(undefined);
  } catch (cause) {
    logError('token_set_failed', { provider, tool_name: tokenType });
    return err(
      new NexusError('TOKEN_WRITE_FAILED', `Failed to write token for ${provider}/${tokenType}.`, {
        isRetryable: true,
        cause,
      }),
    );
  }
};

/** Retrieve a token string. Returns Err with code TOKEN_NOT_FOUND if absent. */
export const getToken = async (
  provider: Provider,
  tokenType: TokenType,
): Promise<Result<string, NexusError>> => {
  const key = buildKey(provider, tokenType);
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value === null || value.length === 0) {
      return err(
        new NexusError('TOKEN_NOT_FOUND', `No token found for ${provider}/${tokenType}.`),
      );
    }
    return ok(value);
  } catch (cause) {
    logError('token_get_failed', { provider, tool_name: tokenType });
    return err(
      new NexusError(
        'SECURE_STORE_UNAVAILABLE',
        `SecureStore read failed for ${provider}/${tokenType}.`,
        { isRetryable: true, cause },
      ),
    );
  }
};

/** Delete a single token. Idempotent — succeeds even if key is absent. */
export const deleteToken = async (
  provider: Provider,
  tokenType: TokenType,
): Promise<Result<void, NexusError>> => {
  const key = buildKey(provider, tokenType);
  try {
    await SecureStore.deleteItemAsync(key);
    logEvent('token_deleted', { provider, tool_name: tokenType });
    return ok(undefined);
  } catch (cause) {
    logError('token_delete_failed', { provider, tool_name: tokenType });
    return err(
      new NexusError('TOKEN_DELETE_FAILED', `Failed to delete ${provider}/${tokenType}.`, {
        isRetryable: true,
        cause,
      }),
    );
  }
};

/**
 * Delete every token associated with a provider. Used by the disconnect flow
 * and as the rollback mechanism for failed bundle writes.
 *
 * Continues through individual failures so that as many keys as possible are
 * cleared; surfaces the first error encountered for the caller's bookkeeping.
 */
export const deleteAllTokensForProvider = async (
  provider: Provider,
): Promise<Result<void, NexusError>> => {
  let firstError: NexusError | null = null;
  for (const tokenType of ALL_TOKEN_TYPES) {
    const result = await deleteToken(provider, tokenType);
    if (!result.ok && firstError === null) {
      firstError = result.error;
    }
  }
  if (firstError !== null) return err(firstError);
  logEvent('provider_disconnected', { provider });
  return ok(undefined);
};

/**
 * Persist a complete OAuth grant atomically:
 *
 *   1. validate every non-null field BEFORE touching SecureStore
 *   2. perform writes serially
 *   3. if any write fails, roll back by clearing every token for this
 *      provider so the caller is never left with a half-rotated state
 *      (e.g. a fresh accessToken paired with a stale tokenExpiry)
 *
 * This is the canonical post-`authorize()` helper. It enforces LAW 5 by
 * preventing the caller from passing the raw OAuth response object.
 */
export const setOAuthBundle = async (
  provider: Provider,
  bundle: {
    accessToken: string;
    refreshToken?: string | null;
    accessTokenExpirationDate: string;
    userEmail?: string | null;
    clientId?: string | null;
  },
): Promise<Result<void, NexusError>> => {
  const candidates: readonly (readonly [TokenType, string | null | undefined])[] = [
    ['accessToken', bundle.accessToken],
    ['refreshToken', bundle.refreshToken],
    ['tokenExpiry', bundle.accessTokenExpirationDate],
    ['userEmail', bundle.userEmail],
    ['clientId', bundle.clientId],
  ];

  const validated: (readonly [TokenType, string])[] = [];
  for (const [tokenType, value] of candidates) {
    if (value === null || value === undefined || value.length === 0) continue;
    const v = validateTokenValue(value);
    if (!v.ok) return v;
    validated.push([tokenType, v.value]);
  }

  for (const [tokenType, value] of validated) {
    const res = await setToken(provider, tokenType, value);
    if (!res.ok) {
      logError('oauth_bundle_rollback', { provider, tool_name: tokenType });
      await deleteAllTokensForProvider(provider);
      return res;
    }
  }
  logEvent('oauth_bundle_set', { provider });
  return ok(undefined);
};

/**
 * Read an entire provider record back. Missing optional fields are reported as
 * `null`. Returns Err only if SecureStore itself is unavailable.
 */
export const getServiceConnection = async (
  provider: Provider,
): Promise<Result<ServiceConnection, NexusError>> => {
  const accessToken = await getToken(provider, 'accessToken');
  const apiKey = await getToken(provider, 'apiKey');
  const isConnected = accessToken.ok || apiKey.ok;

  if (!isConnected) {
    return ok({
      provider,
      status: 'disconnected',
      userEmail: null,
      tokenExpiresAt: null,
    });
  }

  const userEmailResult = await getToken(provider, 'userEmail');
  const expiryResult = await getToken(provider, 'tokenExpiry');

  const tokenExpiresAt =
    expiryResult.ok && !Number.isNaN(Date.parse(expiryResult.value))
      ? Date.parse(expiryResult.value)
      : null;

  return ok({
    provider,
    status: 'connected',
    userEmail: userEmailResult.ok ? userEmailResult.value : null,
    tokenExpiresAt,
  });
};

/**
 * Snapshot all known providers' connection status.
 * Built field-by-field with no `as` casts — the result type follows directly
 * from the explicit destructuring below.
 */
export const getAllConnectedProviders = async (): Promise<Result<VaultSnapshot, NexusError>> => {
  const [google, whatsapp, openai] = await Promise.all([
    getServiceConnection('google'),
    getServiceConnection('whatsapp'),
    getServiceConnection('openai'),
  ]);
  if (!google.ok) return err(google.error);
  if (!whatsapp.ok) return err(whatsapp.error);
  if (!openai.ok) return err(openai.error);
  return ok({
    google: google.value,
    whatsapp: whatsapp.value,
    openai: openai.value,
  });
};

/** Determine whether a provider has at least one credential stored. */
export const isProviderConnected = async (provider: Provider): Promise<boolean> => {
  const conn = await getServiceConnection(provider);
  return conn.ok && conn.value.status === 'connected';
};

/** Wipe all Nexus credentials. Used by the "Clear all data" affordance. */
export const wipeAllCredentials = async (): Promise<Result<void, NexusError>> => {
  for (const provider of ALL_PROVIDERS) {
    const res = await deleteAllTokensForProvider(provider);
    if (!res.ok) return res;
  }
  logEvent('credentials_wiped', {});
  return ok(undefined);
};

/** Test-only helpers (re-exported under a namespace to deter production use). */
export const __internal = {
  ALL_PROVIDERS,
  ALL_TOKEN_TYPES,
  MAX_TOKEN_LENGTH,
  validateTokenValue,
};
