/**
 * Boot orchestration.
 *
 * Called from `app/_layout.tsx` exactly once. The actual sequencing is
 * delegated to `BootSequencer`, which runs every step with a timeout,
 * timing instrumentation, structured logging, and clean failure surfacing.
 *
 * Steps in order:
 *   1. db_init               (critical) — SQLite open + migrations
 *   2. preferences_hydrate   (critical) — load user_preferences rows
 *   3. vault_hydrate         (critical) — read SecureStore
 *   4. settings_hydrate      (critical) — load AI provider config
 *   5. http_deps             (critical) — install apiClient deps
 *   6. oauth_backend         (non_critical) — wire react-native-app-auth.
 *                              Failure here only blocks Connect Google,
 *                              not the rest of the app.
 *   7. contacts_backend      (non_critical) — wire expo-contacts.
 *                              Failure only blocks contacts search.
 *   8. memory_tools          (critical) — bind preferences store to
 *                              memory tools so remember_fact works.
 *   9. country_code          (non_critical) — propagate default country
 *                              code to the contacts tool.
 */

import * as ReactNativeAppAuth from 'react-native-app-auth';
import * as ExpoContacts from 'expo-contacts';

import { initializeDatabase } from '../db/database';
import {
  type AppAuthBackend,
  installOAuthBackend,
  refreshAccessToken,
} from './oauthService';
import {
  installApiClientDeps,
  type NexusHttpProvider,
  type RefreshFn,
} from './apiClient';
import {
  installContactsBackend,
  setDefaultCountryCode,
  type ContactsBackend,
  type NativeContact,
} from '../tools/contacts';
import { installPreferencesStore } from '../tools/memory';
import { getPreferencesStore } from '../store/preferencesStore';
import { getSettingsStore } from '../store/settingsStore';
import { getVaultStore } from '../store/vaultStore';
import {
  NexusError,
  type Provider,
  type Result,
  err,
  ok,
} from '../types/auth';
import {
  runBootSequence,
  type BootStep,
  type BootFailure,
} from '../utils/bootSequencer';
import { logEvent } from '../utils/logger';

/**
 * Adapt the `react-native-app-auth` runtime to the abstract
 * `AppAuthBackend` shape oauthService consumes.
 */
const buildAppAuthBackend = (): AppAuthBackend => ({
  authorize: (config) =>
    ReactNativeAppAuth.authorize({
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUrl: config.redirectUrl,
      scopes: [...config.scopes],
      ...(config.additionalParameters !== undefined
        ? { additionalParameters: { ...config.additionalParameters } }
        : {}),
      usePKCE: true,
      dangerouslyAllowInsecureHttpRequests: false,
    }) as ReturnType<AppAuthBackend['authorize']>,
  refresh: (config, params) =>
    ReactNativeAppAuth.refresh(
      {
        issuer: config.issuer,
        clientId: config.clientId,
        redirectUrl: config.redirectUrl,
        scopes: [...config.scopes],
      },
      { refreshToken: params.refreshToken },
    ) as ReturnType<AppAuthBackend['refresh']>,
});

/**
 * Adapt expo-contacts to the abstract ContactsBackend.
 */
const buildContactsBackend = (): ContactsBackend => ({
  requestPermission: async () => {
    const { status } = await ExpoContacts.requestPermissionsAsync();
    return { granted: status === 'granted' };
  },
  getContacts: async () => {
    const { data } = await ExpoContacts.getContactsAsync({
      fields: [ExpoContacts.Fields.Name, ExpoContacts.Fields.PhoneNumbers],
    });
    return data.map<NativeContact>((c) => ({
      id: c.id ?? '',
      name: c.name ?? '',
      phoneNumbers: (c.phoneNumbers ?? [])
        .filter((p) => typeof p.number === 'string' && p.number.length > 0)
        .map((p) => ({
          number: p.number ?? '',
          label: p.label ?? null,
        })),
    }));
  },
});

const handleDisconnect = (provider: NexusHttpProvider): void => {
  getVaultStore().getState().markDisconnected(provider as Provider);
};

const buildSteps = (): readonly BootStep[] => [
  {
    id: 'db_init',
    kind: 'critical',
    run: async () => {
      const result = await initializeDatabase();
      return result.ok ? ok(undefined) : err(result.error);
    },
  },
  {
    id: 'preferences_hydrate',
    kind: 'critical',
    run: async () => getPreferencesStore().getState().hydrateFromDb(),
  },
  {
    id: 'vault_hydrate',
    kind: 'critical',
    run: async () => getVaultStore().getState().hydrate(),
  },
  {
    id: 'settings_hydrate',
    kind: 'critical',
    run: async () => getSettingsStore().getState().hydrateFromDb(),
  },
  {
    id: 'http_deps',
    kind: 'critical',
    run: async () => {
      const refreshAdapter: RefreshFn = async (provider) => {
        if (provider !== 'google') {
          return err(
            new NexusError('SESSION_EXPIRED', `${provider} cannot be refreshed.`),
          );
        }
        return refreshAccessToken('google');
      };
      installApiClientDeps({ refresh: refreshAdapter, onDisconnected: handleDisconnect });
      return ok(undefined);
    },
  },
  {
    id: 'oauth_backend',
    kind: 'non_critical',
    run: async () => {
      try {
        installOAuthBackend(buildAppAuthBackend());
        return ok(undefined);
      } catch (cause) {
        return err(
          new NexusError(
            'PROVIDER_ERROR',
            'react-native-app-auth backend installation failed; Connect Google will be unavailable.',
            { isRetryable: false, cause },
          ),
        );
      }
    },
  },
  {
    id: 'contacts_backend',
    kind: 'non_critical',
    run: async () => {
      try {
        installContactsBackend(buildContactsBackend());
        return ok(undefined);
      } catch (cause) {
        return err(
          new NexusError(
            'PROVIDER_ERROR',
            'expo-contacts backend installation failed; contact search will be unavailable.',
            { isRetryable: false, cause },
          ),
        );
      }
    },
  },
  {
    id: 'memory_tools',
    kind: 'critical',
    run: async () => {
      installPreferencesStore(getPreferencesStore());
      return ok(undefined);
    },
  },
  {
    id: 'country_code',
    kind: 'non_critical',
    run: async () => {
      const country = getSettingsStore().getState().defaultCountryCode;
      setDefaultCountryCode(country);
      return ok(undefined);
    },
  },
];

export interface BootstrapResult {
  /** Number of successful critical steps. Useful for analytics. */
  readonly stepsCompleted: number;
  readonly nonCriticalFailures: readonly BootFailure[];
  readonly totalLatencyMs: number;
}

export const bootstrap = async (): Promise<Result<BootstrapResult, BootFailure>> => {
  const result = await runBootSequence(buildSteps());
  if (!result.ok) return err(result.error);
  logEvent('boot_complete', {
    total_latency_ms: result.value.totalLatencyMs,
    iteration: result.value.completed.length,
  });
  return ok({
    stepsCompleted: result.value.completed.length,
    nonCriticalFailures: result.value.nonCriticalFailures,
    totalLatencyMs: result.value.totalLatencyMs,
  });
};

/** Test seam — exposes the step graph so unit tests can drive each in isolation. */
export const __internal = { buildSteps, buildAppAuthBackend, buildContactsBackend };
