/**
 * OAuth service — Google PKCE flow + token rotation.
 *
 * Wraps `react-native-app-auth`. Every credential acquired here flows
 * through `tokenService.setOAuthBundle` so the existing atomic-rollback
 * contract from PR #1+#2 covers the rotation path automatically.
 *
 * The client ID is supplied by the user (per the engineering directive's
 * "user's own API keys" requirement) and read from SecureStore at the
 * top of every flow. There is no hardcoded client ID anywhere.
 *
 * Cycle One supports 'google'. WhatsApp + others extend the union later.
 */

import { NexusError, type Provider, type Result, err, ok } from '../types/auth';
import { logEvent, logError } from '../utils/logger';

import * as tokenService from './tokenService';

/**
 * Subset of the react-native-app-auth surface we depend on. Captured as
 * an interface so the unit tests can stub it without booting RN.
 */
export interface AppAuthBackend {
  authorize: (config: AppAuthConfig) => Promise<AppAuthResult>;
  refresh: (
    config: AppAuthConfig,
    params: { refreshToken: string },
  ) => Promise<{
    accessToken: string;
    accessTokenExpirationDate: string;
    refreshToken?: string | null;
  }>;
}

export interface AppAuthConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUrl: string;
  readonly scopes: readonly string[];
  readonly additionalParameters?: Readonly<Record<string, string>>;
}

export interface AppAuthResult {
  readonly accessToken: string;
  readonly accessTokenExpirationDate: string;
  readonly refreshToken?: string | null;
  readonly idToken?: string | null;
  readonly tokenType?: string;
  readonly scopes?: readonly string[];
}

const REDIRECT_URL = 'com.nexus.app:/oauth2redirect/google' as const;
const ISSUER = 'https://accounts.google.com' as const;
const SCOPES: readonly string[] = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
];

let backend: AppAuthBackend | null = null;

/** Inject the react-native-app-auth backend at boot. */
export const installOAuthBackend = (impl: AppAuthBackend): void => {
  backend = impl;
};

/** Build the canonical Google PKCE config given a runtime client ID. */
export const buildGoogleConfig = (clientId: string): AppAuthConfig => ({
  issuer: ISSUER,
  clientId,
  redirectUrl: REDIRECT_URL,
  scopes: SCOPES,
  additionalParameters: { access_type: 'offline', prompt: 'consent' },
});

/**
 * Decode the payload section of a JWT id_token without verifying its
 * signature. The id_token came from a freshly completed authorize()
 * round-trip with the IdP, so on-device signature verification adds no
 * real safety. Returns `{ email: null }` on any parse failure rather
 * than throwing — LAW 3.
 */
export const decodeIdToken = (idToken: string): { email: string | null } => {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return { email: null };
    const payloadB64 = parts[1];
    if (typeof payloadB64 !== 'string' || payloadB64.length === 0) return { email: null };
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = base64DecodeUtf8(padded);
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object') return { email: null };
    const email = (parsed as { email?: unknown }).email;
    return { email: typeof email === 'string' && email.length > 0 ? email : null };
  } catch {
    return { email: null };
  }
};

/**
 * Minimal cross-platform base64 decoder. `atob` is available in modern
 * Node and React Native (Hermes), but we keep a Buffer fallback so the
 * Jest (node) runner doesn't depend on a global polyfill.
 */
const base64DecodeUtf8 = (b64: string): string => {
  const padding = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const padded = b64 + padding;
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    let s = '';
    for (let i = 0; i < binary.length; i += 1) {
      s += String.fromCharCode(binary.charCodeAt(i));
    }
    return decodeURIComponent(escape(s));
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
};

/**
 * Connect a provider via the PKCE flow. Persists every field of the
 * grant atomically via tokenService.setOAuthBundle. Returns the user
 * email decoded from the id_token (or null if the IdP didn't return one).
 */
export const connect = async (
  provider: 'google',
  clientId: string,
): Promise<Result<{ email: string | null }, NexusError>> => {
  if (backend === null) {
    return err(
      new NexusError('UNKNOWN', 'OAuth backend not installed.', { isRetryable: false }),
    );
  }
  if (clientId.length === 0) {
    return err(
      new NexusError('INVALID_INPUT', 'Google client ID is required.', { isRetryable: false }),
    );
  }
  const config = buildGoogleConfig(clientId);
  let result: AppAuthResult;
  try {
    result = await backend.authorize(config);
  } catch (cause) {
    logError('oauth_authorize_failed', { provider });
    return err(
      new NexusError('PROVIDER_ERROR', 'Authorization flow failed.', {
        isRetryable: true,
        cause,
      }),
    );
  }

  const email = result.idToken ? decodeIdToken(result.idToken).email : null;

  const persist = await tokenService.setOAuthBundle(provider, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? null,
    accessTokenExpirationDate: result.accessTokenExpirationDate,
    userEmail: email,
    clientId,
  });
  if (!persist.ok) return err(persist.error);

  logEvent('oauth_connected', { provider });
  return ok({ email });
};

/**
 * Disconnect a provider: deletes every stored credential atomically
 * (best-effort across the SecureStore backend).
 */
export const disconnect = async (provider: Provider): Promise<Result<void, NexusError>> => {
  const result = await tokenService.deleteAllTokensForProvider(provider);
  if (result.ok) logEvent('oauth_disconnected', { provider });
  return result;
};

/**
 * Refresh an access token. Returns the new bearer string on success
 * so the apiClient interceptor can replay the failing request.
 */
export const refreshAccessToken = async (
  provider: 'google',
): Promise<Result<string, NexusError>> => {
  if (backend === null) {
    return err(
      new NexusError('UNKNOWN', 'OAuth backend not installed.', { isRetryable: false }),
    );
  }
  const refreshToken = await tokenService.getToken(provider, 'refreshToken');
  if (!refreshToken.ok) {
    return err(
      new NexusError('SESSION_EXPIRED', `No refresh token stored for ${provider}.`, {
        isRetryable: false,
      }),
    );
  }
  const clientIdResult = await tokenService.getToken(provider, 'clientId');
  if (!clientIdResult.ok) {
    return err(
      new NexusError('SESSION_EXPIRED', `No client ID stored for ${provider}.`, {
        isRetryable: false,
      }),
    );
  }
  const config = buildGoogleConfig(clientIdResult.value);
  try {
    const refreshed = await backend.refresh(config, { refreshToken: refreshToken.value });
    const persist = await tokenService.setOAuthBundle(provider, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken.value,
      accessTokenExpirationDate: refreshed.accessTokenExpirationDate,
      clientId: clientIdResult.value,
    });
    if (!persist.ok) return err(persist.error);
    logEvent('oauth_refresh_succeeded', { provider });
    return ok(refreshed.accessToken);
  } catch (cause) {
    logError('oauth_refresh_failed', { provider });
    return err(
      new NexusError('SESSION_EXPIRED', 'Token refresh failed.', {
        isRetryable: false,
        cause,
      }),
    );
  }
};

/** Test-only: clear the installed backend. */
export const __resetForTests = (): void => {
  backend = null;
};
