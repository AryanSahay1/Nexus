/**
 * Shared Axios HTTP client with the Nexus token-injection and 401-refresh
 * interceptors.
 *
 * Every external API call (OpenAI, Gmail, Calendar, future WhatsApp) goes
 * through this single client. Two interceptors enforce the contract:
 *
 *   REQUEST:
 *     - if `nexusProvider` is set, inject the matching bearer token from
 *       SecureStore. For 'openai' the bearer is the user's apiKey; for
 *       'google' it is the OAuth accessToken.
 *
 *   RESPONSE-ERROR (401 only, google only):
 *     - on first failure (`_retry !== true`) await a deduplicated refresh
 *       (concurrent 401s share one round-trip) and replay the original
 *       request with the new token.
 *     - on refresh failure mark the provider disconnected in vaultStore
 *       and throw `SessionExpiredError` for the agent loop to convert
 *       into a semantic LLM message.
 *
 *   RESPONSE-ERROR (other):
 *     - normalize to a NexusError with the right `code` + `isRetryable`
 *       per the directive's error-handling discipline. The original
 *       response body and status are scrubbed of PII before logging.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  NexusError,
  type Provider,
  type Result,
  err,
  ok,
} from '../types/auth';
import { logError, logEvent } from '../utils/logger';

import * as tokenService from './tokenService';

/**
 * Provider tag used by the request interceptor to inject the right bearer.
 *
 * Note: WhatsApp is excluded because Cycle One does not implement the
 * WhatsApp service. Adding it later is a one-line union extension.
 */
export type NexusHttpProvider = 'google' | 'openai';

export interface NexusRequestConfig extends AxiosRequestConfig {
  readonly nexusProvider?: NexusHttpProvider;
  /** internal — set on retry after a successful refresh; never set by callers */
  _retry?: boolean;
}

type AugmentedAxiosConfig = InternalAxiosRequestConfig & {
  nexusProvider?: NexusHttpProvider;
  _retry?: boolean;
};

/**
 * Thrown (rejected from axios) when the refresh path itself fails. The
 * agent loop catches this and converts it into a tool-result error string
 * the LLM can apologize about — never an unhandled promise rejection.
 */
export class SessionExpiredError extends NexusError {
  constructor(provider: Provider, options?: { cause?: unknown }) {
    super('SESSION_EXPIRED', `Session expired for ${provider}; reconnect required.`, {
      isRetryable: false,
      ...(options?.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = 'SessionExpiredError';
    Object.setPrototypeOf(this, SessionExpiredError.prototype);
  }
}

/**
 * Caller hook used by the apiClient to refresh a provider's access token.
 * The real implementation lives in `oauthService.refreshAccessToken`. We
 * accept it as an injection point so the apiClient unit tests can drive
 * the refresh path without depending on react-native-app-auth.
 */
export type RefreshFn = (provider: NexusHttpProvider) => Promise<Result<string, NexusError>>;

/**
 * Caller hook used by the apiClient to mark a provider disconnected after
 * a refresh failure. Usually wired to `vaultStore.markDisconnected`.
 */
export type DisconnectedFn = (provider: NexusHttpProvider) => void;

interface NexusHttpDeps {
  readonly refresh: RefreshFn;
  readonly onDisconnected: DisconnectedFn;
}

let installedDeps: NexusHttpDeps | null = null;

/**
 * Wire the apiClient to the rest of the app. MUST be called once at boot
 * (before any HTTP traffic) by `app/_layout.tsx`.
 */
export const installApiClientDeps = (deps: NexusHttpDeps): void => {
  installedDeps = deps;
};

/** In-flight refresh dedupe (closes PRD §4 D-2). */
const inflightRefresh = new Map<NexusHttpProvider, Promise<Result<string, NexusError>>>();

const getOrCreateRefresh = (
  provider: NexusHttpProvider,
): Promise<Result<string, NexusError>> => {
  const existing = inflightRefresh.get(provider);
  if (existing) return existing;
  if (installedDeps === null) {
    return Promise.resolve(
      err(new NexusError('UNKNOWN', 'apiClient deps not installed.', { isRetryable: false })),
    );
  }
  const p = installedDeps.refresh(provider).finally(() => {
    inflightRefresh.delete(provider);
  });
  inflightRefresh.set(provider, p);
  return p;
};

const getBearerForProvider = async (
  provider: NexusHttpProvider,
): Promise<Result<string, NexusError>> => {
  const tokenType = provider === 'openai' ? 'apiKey' : 'accessToken';
  return tokenService.getToken(provider, tokenType);
};

/**
 * Map an axios error into a NexusError with the correct code and
 * isRetryable flag. Never includes the response body in the error
 * message — only the HTTP status — to keep PII out of error surfaces.
 */
const mapHttpError = (error: AxiosError): NexusError => {
  const status = error.response?.status;
  const headers = (error.response?.headers ?? {}) as Record<string, unknown>;
  if (status === undefined) {
    return new NexusError('NETWORK_ERROR', 'Network request failed.', {
      isRetryable: true,
      cause: error,
    });
  }
  if (status === 429) {
    const rawRetryAfter = headers['retry-after'];
    const retryAfterSeconds =
      typeof rawRetryAfter === 'string' && /^\d+$/.test(rawRetryAfter)
        ? parseInt(rawRetryAfter, 10)
        : null;
    const message =
      retryAfterSeconds !== null
        ? `Rate limited; retry after ${retryAfterSeconds}s.`
        : 'Rate limited.';
    return new NexusError('RATE_LIMITED', message, { isRetryable: true, cause: error });
  }
  if (status >= 500) {
    return new NexusError('NETWORK_ERROR', `Upstream returned ${status}.`, {
      isRetryable: true,
      cause: error,
    });
  }
  if (status === 401) {
    return new NexusError('SESSION_EXPIRED', 'Authentication failed.', {
      isRetryable: false,
      cause: error,
    });
  }
  return new NexusError('PROVIDER_ERROR', `Upstream returned ${status}.`, {
    isRetryable: false,
    cause: error,
  });
};

/**
 * Build a fresh AxiosInstance with both interceptors attached.
 *
 * Exposed as a factory (not just a const) so unit tests can build their
 * own isolated client without state bleeding between tests. The default
 * shared instance is exported below as `apiClient`.
 */
export const createNexusApiClient = (): AxiosInstance => {
  const instance = axios.create({
    timeout: 30000,
    headers: { Accept: 'application/json' },
  });

  instance.interceptors.request.use(async (config) => {
    const cfg = config as AugmentedAxiosConfig;
    if (cfg.nexusProvider !== undefined) {
      const tokenResult = await getBearerForProvider(cfg.nexusProvider);
      if (tokenResult.ok) {
        cfg.headers.set('Authorization', `Bearer ${tokenResult.value}`);
      }
    }
    return cfg;
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const cfg = error.config as AugmentedAxiosConfig | undefined;
      const status = error.response?.status;

      if (
        status === 401 &&
        cfg !== undefined &&
        cfg.nexusProvider === 'google' &&
        cfg._retry !== true
      ) {
        cfg._retry = true;
        logEvent('api_token_refresh_started', { provider: 'google' });
        const refreshed = await getOrCreateRefresh('google');
        if (!refreshed.ok) {
          logError('api_token_refresh_failed', { provider: 'google' });
          installedDeps?.onDisconnected('google');
          return Promise.reject(new SessionExpiredError('google', { cause: refreshed.error }));
        }
        logEvent('api_token_refresh_succeeded', { provider: 'google' });
        cfg.headers.set('Authorization', `Bearer ${refreshed.value}`);
        return instance.request(cfg);
      }

      const mapped = mapHttpError(error);
      logError('api_request_failed', {
        provider: cfg?.nexusProvider ?? 'unknown',
        http_status: status ?? 0,
        error_code: mapped.code,
      });
      return Promise.reject(mapped);
    },
  );

  return instance;
};

/** Shared singleton — every service in the app imports this. */
export const apiClient: AxiosInstance = createNexusApiClient();

/**
 * Convenience wrapper. Service modules that want `Result<T, NexusError>`
 * semantics on top of the axios call site can route through this helper.
 */
export const requestAsResult = async <T>(
  client: AxiosInstance,
  config: NexusRequestConfig,
): Promise<Result<T, NexusError>> => {
  try {
    const response = await client.request<T>(config);
    return ok(response.data);
  } catch (caught) {
    if (caught instanceof NexusError) return err(caught);
    return err(
      new NexusError('UNKNOWN', 'Unhandled error in apiClient.', {
        isRetryable: false,
        cause: caught,
      }),
    );
  }
};

/** Test-only: clear in-flight refresh dedupe state and uninstall deps. */
export const __resetForTests = (): void => {
  inflightRefresh.clear();
  installedDeps = null;
};
