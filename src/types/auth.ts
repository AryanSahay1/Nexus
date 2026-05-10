/**
 * Authentication and credential types for Project Nexus.
 *
 * Nexus is local-first: all credentials live exclusively in the device's
 * secure enclave (iOS Keychain / Android Keystore) via expo-secure-store.
 * These types describe the in-memory shape of credentials and never include
 * raw secrets when serialized for state stores or logs.
 */

/** Identifier for an external service the user can connect to Nexus. */
export type Provider = 'google' | 'whatsapp' | 'openai';

/**
 * Logical token kinds Nexus stores per provider.
 *
 * - `accessToken`: short-lived bearer credential
 * - `refreshToken`: long-lived credential used to mint new access tokens
 * - `apiKey`: long-lived static credential (e.g. OpenAI sk-...)
 * - `tokenExpiry`: ISO 8601 timestamp string when the access token expires
 * - `userEmail`: the account email associated with the OAuth grant
 * - `clientId`: the user-supplied OAuth client identifier (not a secret,
 *   but stored alongside the provider record for consistency)
 */
export type TokenType =
  | 'accessToken'
  | 'refreshToken'
  | 'apiKey'
  | 'tokenExpiry'
  | 'userEmail'
  | 'clientId';

/** Construct the canonical SecureStore key for a (provider, tokenType) pair. */
export type SecureStoreKey = `nexus_${Provider}_${TokenType}`;

/**
 * Strongly-typed OAuth token bundle as returned by react-native-app-auth.
 * NEVER persist this object verbatim — write each string to SecureStore separately.
 */
export interface OAuthToken {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly accessTokenExpirationDate: string;
  readonly idToken: string | null;
  readonly tokenType: string;
  readonly scopes: readonly string[];
}

/** A user's connection to a single provider. */
export interface ServiceConnection {
  readonly provider: Provider;
  readonly status: 'connected' | 'disconnected';
  readonly userEmail: string | null;
  readonly connectedAt: number | null;
  readonly tokenExpiresAt: number | null;
}

/** Provider connection status snapshot, used by the Vault screen. */
export interface VaultSnapshot {
  readonly google: ServiceConnection;
  readonly whatsapp: ServiceConnection;
  readonly openai: ServiceConnection;
}

/** Stable, machine-readable error codes used across the service layer. */
export type NexusErrorCode =
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_WRITE_FAILED'
  | 'TOKEN_DELETE_FAILED'
  | 'INVALID_TOKEN_VALUE'
  | 'SECURE_STORE_UNAVAILABLE'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';

/**
 * Canonical error class for the Nexus service layer.
 * All service functions surface failures as `Result<T, NexusError>` rather
 * than throwing across module boundaries.
 */
export class NexusError extends Error {
  public readonly code: NexusErrorCode;
  public readonly isRetryable: boolean;
  public readonly cause?: unknown;

  constructor(code: NexusErrorCode, message: string, options?: { isRetryable?: boolean; cause?: unknown }) {
    super(message);
    this.name = 'NexusError';
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, NexusError.prototype);
  }
}

/** Discriminated-union Result type used throughout the service layer. */
export type Result<T, E = NexusError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Construct an Ok result. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Construct an Err result. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Type guard for Ok results. */
export const isOk = <T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } => r.ok;

/** Type guard for Err results. */
export const isErr = <T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } => !r.ok;
