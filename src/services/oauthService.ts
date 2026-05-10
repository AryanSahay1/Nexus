/**
 * OAuth orchestrator for Project Nexus.
 *
 * Currently implements the Google PKCE flow; the same shape will scale to
 * other OAuth providers later. The native module that performs the actual
 * authorize / refresh dance (`react-native-app-auth`) is **never imported
 * from here directly** — it's installed via `installOAuthBackend()` so the
 * service stays trivially mockable in unit tests and can be lazy-loaded on
 * Android (where the native bridge can be slow to wake up).
 *
 * Contract:
 *   - `connect()`     authorise → decode id_token email → persist bundle
 *   - `disconnect()`  delete every stored credential for the provider
 *   - `refreshAccessToken()`  rotate the access token, persist the bundle,
 *                             return the new bearer string. Hooked into
 *                             `apiClient.installRefreshHandler` so the HTTP
 *                             pipeline can recover transparently.
 *
 * Every failure mode that prevents a successful refresh maps to
 * `SESSION_EXPIRED` (non-retryable) — the caller's only recourse is to ask
 * the user to reconnect.
 */

import { installRefreshHandler } from './apiClient';
import * as tokenService from './tokenService';
import { NexusError, type Provider, type Result, err, ok } from '../types/auth';
import { logError, logEvent, logWarn } from '../utils/logger';

// ── Backend contract ──────────────────────────────────────────────────────
//
// The native module is described here as a pure interface so the service
// has zero compile-time coupling to react-native-app-auth.

/** Subset of `react-native-app-auth`'s authorize() result we depend on. */
export interface AuthorizeResult {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly accessTokenExpirationDate: string;
  readonly idToken: string | null;
  readonly tokenType: string;
  readonly scopes: readonly string[];
}

/** Subset of the refresh() result. */
export interface RefreshResult {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly accessTokenExpirationDate: string;
}

/**
 * The native-module-shaped backend Nexus talks to. Real implementations
 * delegate to react-native-app-auth; tests pass a stub.
 */
export interface OAuthBackend {
  authorize: (config: GoogleConfig) => Promise<AuthorizeResult>;
  refresh: (
    config: GoogleConfig,
    args: { readonly refreshToken: string },
  ) => Promise<RefreshResult>;
}

let backend: OAuthBackend | null = null;

export const installOAuthBackend = (impl: OAuthBackend | null): void => {
  backend = impl;
};

// ── Google config ─────────────────────────────────────────────────────────

/** PKCE config shape consumed by react-native-app-auth. */
export interface GoogleConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUrl: string;
  readonly scopes: readonly string[];
  readonly additionalParameters: Readonly<Record<string, string>>;
}

const GOOGLE_ISSUER = 'https://accounts.google.com' as const;
const GOOGLE_REDIRECT_URL = 'com.nexus.app:/oauth2redirect/google' as const;
const GOOGLE_SCOPES: readonly string[] = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
];

/** Build the Google PKCE config. `clientId` is supplied by the user via the Vault. */
export const buildGoogleConfig = (clientId: string): GoogleConfig => ({
  issuer: GOOGLE_ISSUER,
  clientId,
  redirectUrl: GOOGLE_REDIRECT_URL,
  scopes: GOOGLE_SCOPES,
  additionalParameters: {
    access_type: 'offline',
    prompt: 'consent',
  },
});

// ── ID token email extraction ─────────────────────────────────────────────

/**
 * Extracts the `email` claim from a Google `id_token` (a JWT). Returns
 * `null` when the token is malformed or the claim is missing — never
 * throws. We deliberately do NOT verify the JWT signature client-side;
 * that's the AS's job. Trust here is bounded to "we just got this token
 * back from a TLS-pinned exchange with Google".
 */
export const decodeIdToken = (idToken: string): string | null => {
  if (typeof idToken !== 'string' || idToken.length === 0) return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (payload === undefined || payload.length === 0) return null;
  try {
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeBase64(base64);
    const obj: unknown = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return null;
    const email = (obj as { readonly email?: unknown }).email;
    return typeof email === 'string' && email.length > 0 ? email : null;
  } catch {
    return null;
  }
};

const decodeBase64 = (input: string): string => {
  // Use Buffer when available (Node, jest); fall back to atob in RN.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'base64').toString('utf8');
  }
  /* istanbul ignore next — exercised only on the device */
  if (typeof atob === 'function') {
    return atob(input);
  }
  /* istanbul ignore next */
  throw new Error('No base64 decoder available in this environment.');
};

// ── connect / disconnect / refresh ────────────────────────────────────────

const requireBackend = (): Result<OAuthBackend, NexusError> => {
  if (backend === null) {
    return err(
      new NexusError(
        'PROVIDER_ERROR',
        'OAuth backend not installed. Call installOAuthBackend() before connect().',
      ),
    );
  }
  return ok(backend);
};

/**
 * Connect a Google account: run the PKCE dance, decode the email, persist
 * each token field individually (LAW 5).
 */
export const connect = async (clientId: string): Promise<Result<void, NexusError>> => {
  if (clientId.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'Google clientId is required.'));
  }
  const backendResult = requireBackend();
  if (!backendResult.ok) return backendResult;

  const config = buildGoogleConfig(clientId);

  let authorized: AuthorizeResult;
  try {
    authorized = await backendResult.value.authorize(config);
  } catch (cause) {
    logError('oauth_authorize_failed', { provider: 'google' });
    return err(
      new NexusError('SESSION_EXPIRED', 'Google authorization failed.', {
        isRetryable: false,
        cause,
      }),
    );
  }

  const userEmail = authorized.idToken !== null ? decodeIdToken(authorized.idToken) : null;

  const persisted = await tokenService.setOAuthBundle('google', {
    accessToken: authorized.accessToken,
    refreshToken: authorized.refreshToken,
    accessTokenExpirationDate: authorized.accessTokenExpirationDate,
    userEmail,
    clientId,
  });
  if (!persisted.ok) return persisted;

  logEvent('oauth_connected', { provider: 'google' });
  return ok(undefined);
};

/** Wipe every stored credential for a provider. */
export const disconnect = async (
  provider: Provider,
): Promise<Result<void, NexusError>> => {
  const result = await tokenService.deleteAllTokensForProvider(provider);
  if (result.ok) {
    logEvent('oauth_disconnected', { provider });
  }
  return result;
};

/**
 * Rotate the access token for a provider. Reads the refresh token + clientId
 * from SecureStore, calls the backend, persists the rotated bundle, and
 * returns the fresh bearer string for the caller (the apiClient retry path).
 */
export const refreshAccessToken = async (
  provider: Provider,
): Promise<Result<string, NexusError>> => {
  if (provider !== 'google') {
    return err(
      new NexusError('SESSION_EXPIRED', `Refresh is not supported for provider ${provider}.`),
    );
  }
  const backendResult = requireBackend();
  if (!backendResult.ok) {
    return err(
      new NexusError('SESSION_EXPIRED', 'OAuth backend unavailable for refresh.', {
        cause: backendResult.error,
      }),
    );
  }

  const refreshToken = await tokenService.getToken(provider, 'refreshToken');
  if (!refreshToken.ok) {
    logWarn('oauth_refresh_no_refresh_token', { provider });
    return err(
      new NexusError('SESSION_EXPIRED', 'No refresh token stored. User must reconnect.'),
    );
  }
  const clientId = await tokenService.getToken(provider, 'clientId');
  if (!clientId.ok) {
    logWarn('oauth_refresh_no_client_id', { provider });
    return err(
      new NexusError('SESSION_EXPIRED', 'No clientId stored. User must reconnect.'),
    );
  }

  const config = buildGoogleConfig(clientId.value);

  let rotated: RefreshResult;
  try {
    rotated = await backendResult.value.refresh(config, { refreshToken: refreshToken.value });
  } catch (cause) {
    logError('oauth_refresh_failed', { provider });
    return err(
      new NexusError('SESSION_EXPIRED', 'Refresh request failed; user must reconnect.', {
        isRetryable: false,
        cause,
      }),
    );
  }

  // Persist the rotated bundle. Google may or may not return a new refresh
  // token — when missing, keep the existing one (default contract per RFC).
  const persisted = await tokenService.setOAuthBundle(provider, {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken ?? refreshToken.value,
    accessTokenExpirationDate: rotated.accessTokenExpirationDate,
  });
  if (!persisted.ok) {
    return err(
      new NexusError('SESSION_EXPIRED', 'Refresh succeeded but persistence failed.', {
        cause: persisted.error,
      }),
    );
  }

  logEvent('oauth_refreshed', { provider });
  return ok(rotated.accessToken);
};

/**
 * Wires the apiClient's refresh hook to `refreshAccessToken`. Called once
 * from app/_layout.tsx during boot. Idempotent — safe to call multiple
 * times (each call replaces the previous handler).
 */
export const wireApiClientRefresh = (): void => {
  installRefreshHandler(async (provider) => refreshAccessToken(provider));
};

/** Test-only helpers. */
export const __internal = {
  GOOGLE_ISSUER,
  GOOGLE_REDIRECT_URL,
  GOOGLE_SCOPES,
  decodeBase64,
  resetForTests: (): void => {
    backend = null;
    installRefreshHandler(null);
  },
};
