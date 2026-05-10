/**
 * Centralised HTTP client for Project Nexus.
 *
 * Built on top of Axios, this module is the single egress point for every
 * upstream service Nexus talks to (OpenAI, Gmail, Google Calendar). Two
 * invariants make it trustworthy across the rest of the agent pipeline:
 *
 *   1. Authorization headers are injected from `tokenService.getToken`
 *      automatically — call sites must never reach into SecureStore.
 *   2. A 401 response triggers exactly ONE refresh + retry. A second 401
 *      surfaces as `Result<…, NexusError>` with code `SESSION_EXPIRED`.
 *      Nothing throws across the module boundary (LAW 6).
 *
 * The OAuth refresh strategy is plugged in by `oauthService` via
 * `installRefreshHandler` so this module stays free of native imports and
 * trivially mockable from unit tests.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { NexusError, type Provider, type Result, err, ok } from '../types/auth';
import { logError, logEvent, logWarn } from '../utils/logger';
import * as tokenService from './tokenService';

/**
 * Options accepted by every Nexus HTTP call. We deliberately wrap Axios's
 * `AxiosRequestConfig` instead of re-exporting it so the call sites cannot
 * supply unsupported escape hatches (e.g. `paramsSerializer`).
 */
export interface NexusRequestOptions {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly url: string;
  readonly provider?: Provider;
  readonly params?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  /**
   * When `true`, no `Authorization` header is attached and 401s are NOT
   * retried (used for the OpenAI completions call where the API key is
   * passed in the `Authorization` header by the caller and there's no
   * refresh path).
   */
  readonly skipAuth?: boolean;
}

/** Per-request bookkeeping piggy-backed onto the Axios config. */
interface NexusMetadata {
  provider: Provider | undefined;
  skipAuth: boolean | undefined;
  retried: boolean;
}
interface NexusInternalConfig extends InternalAxiosRequestConfig {
  metadata?: NexusMetadata;
}

/**
 * Pluggable refresh hook installed by `oauthService`. Returns the new
 * bearer token on success, or an `NexusError` describing why it cannot
 * recover. The HTTP client never imports `oauthService` directly —
 * dependency-inverted to keep the layering clean and unit tests fast.
 */
export type RefreshHandler = (provider: Provider) => Promise<Result<string, NexusError>>;

let refreshHandler: RefreshHandler | null = null;

export const installRefreshHandler = (handler: RefreshHandler | null): void => {
  refreshHandler = handler;
};

/**
 * Single shared Axios instance. Exported via the test helper but otherwise
 * private — code outside this module must use `nexusRequest()`.
 */
let axiosInstance: AxiosInstance = createInstance();

function createInstance(): AxiosInstance {
  const inst = axios.create({ timeout: 15_000 });

  inst.interceptors.request.use(async (config) => {
    const cfg = config as NexusInternalConfig;
    const provider = cfg.metadata?.provider;
    if (cfg.metadata?.skipAuth || provider === undefined) return cfg;
    // On a retry the response interceptor has already written the rotated
    // bearer; never overwrite it with the stale value still in SecureStore.
    if (cfg.metadata?.retried === true) return cfg;

    const token = await tokenService.getToken(provider, 'accessToken');
    if (token.ok) {
      cfg.headers.set('Authorization', `Bearer ${token.value}`);
    }
    return cfg;
  });

  inst.interceptors.response.use(
    (response) => response,
    async (error: AxiosError): Promise<AxiosResponse> => {
      const cfg = error.config as NexusInternalConfig | undefined;
      const status = error.response?.status;

      if (status === 401 && cfg !== undefined && cfg.metadata !== undefined && !cfg.metadata.retried) {
        const provider = cfg.metadata.provider;
        if (provider === undefined || refreshHandler === null) {
          throw error;
        }
        cfg.metadata.retried = true;

        logWarn('http_401_refresh_attempt', { provider });
        const refreshed = await refreshHandler(provider);
        if (!refreshed.ok) {
          throw error;
        }
        cfg.headers.set('Authorization', `Bearer ${refreshed.value}`);
        return inst.request(cfg);
      }
      throw error;
    },
  );

  return inst;
}

/**
 * Issue an HTTP request through the Nexus pipeline. Returns a `Result`
 * carrying the parsed JSON body on success, or a typed `NexusError`
 * describing the failure mode. Never throws.
 */
export const nexusRequest = async <T = unknown>(
  options: NexusRequestOptions,
): Promise<Result<T, NexusError>> => {
  const metadata: NexusMetadata = {
    provider: options.provider,
    skipAuth: options.skipAuth,
    retried: false,
  };
  const config: AxiosRequestConfig & { metadata: NexusMetadata } = {
    method: options.method,
    url: options.url,
    params: options.params,
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
    data: options.body,
    timeout: options.timeoutMs ?? 15_000,
    metadata,
    validateStatus: (s) => s >= 200 && s < 300,
  };

  try {
    const response = await axiosInstance.request<T>(config);
    logEvent('http_success', {
      provider: options.provider ?? 'openai',
      http_status: response.status,
    });
    return ok(response.data);
  } catch (raw) {
    return err(toNexusError(raw, options));
  }
};

/** Translate an Axios failure into the canonical `NexusError`. */
const toNexusError = (raw: unknown, options: NexusRequestOptions): NexusError => {
  if (axios.isAxiosError(raw)) {
    const status = raw.response?.status;
    const cfg = raw.config as NexusInternalConfig | undefined;

    if (status === 401) {
      const wasRetried = cfg?.metadata?.retried === true;
      logError('http_session_expired', {
        provider: options.provider ?? 'openai',
        retry_count: wasRetried ? 1 : 0,
      });
      return new NexusError(
        'SESSION_EXPIRED',
        'The session has expired and could not be refreshed. Reconnect the provider.',
        { isRetryable: false, cause: raw },
      );
    }

    if (status === 403) {
      return new NexusError('PERMISSION_DENIED', 'Upstream rejected the request as forbidden.', {
        isRetryable: false,
        cause: raw,
      });
    }

    if (status === 404) {
      return new NexusError('NOT_FOUND', 'Upstream resource not found.', {
        isRetryable: false,
        cause: raw,
      });
    }

    if (typeof status === 'number' && status >= 500) {
      return new NexusError('PROVIDER_ERROR', `Upstream error: HTTP ${status}.`, {
        isRetryable: true,
        cause: raw,
      });
    }

    if (typeof status === 'number') {
      return new NexusError('PROVIDER_ERROR', `Upstream returned HTTP ${status}.`, {
        isRetryable: false,
        cause: raw,
      });
    }

    if (raw.code === 'ECONNABORTED' || raw.code === 'ETIMEDOUT') {
      return new NexusError('NETWORK_ERROR', 'Request timed out.', {
        isRetryable: true,
        cause: raw,
      });
    }

    return new NexusError('NETWORK_ERROR', 'Network request failed.', {
      isRetryable: true,
      cause: raw,
    });
  }

  if (raw instanceof NexusError) return raw;
  return new NexusError('UNKNOWN', 'Unknown failure inside the HTTP client.', {
    isRetryable: false,
    cause: raw,
  });
};

/** Test-only helpers — never used by production code. */
export const __internal = {
  /** Reinstall a fresh Axios instance (clears mocked adapters / state). */
  resetForTests: (): void => {
    axiosInstance = createInstance();
    refreshHandler = null;
  },
  setInstanceForTests: (instance: AxiosInstance): void => {
    axiosInstance = instance;
  },
  getInstance: (): AxiosInstance => axiosInstance,
  getRefreshHandler: (): RefreshHandler | null => refreshHandler,
};
