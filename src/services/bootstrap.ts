/**
 * Boot orchestration.
 *
 * Called from `app/_layout.tsx` exactly once. Wires every cross-module
 * dependency-injection point in the documented order:
 *
 *   1. initialize SQLite + run migrations
 *   2. hydrate preferencesStore from the database
 *   3. hydrate vaultStore from SecureStore
 *   4. hydrate settingsStore from the database
 *   5. install apiClient deps (refresh + onDisconnected)
 *   6. install OAuth backend (react-native-app-auth)
 *   7. install contacts backend (expo-contacts)
 *   8. install preferences store reference into the memory tools
 *   9. propagate default country code to the contacts tool
 *
 * Each step returns Err on failure — UI must surface a clear message
 * rather than crashing (LAW 3).
 */

import * as ReactNativeAppAuth from 'react-native-app-auth';
import * as ExpoContacts from 'expo-contacts';

import { initializeDatabase } from '../db/database';
import { type AppAuthBackend, installOAuthBackend, refreshAccessToken } from './oauthService';
import { installApiClientDeps, type NexusHttpProvider, type RefreshFn } from './apiClient';
import { installContactsBackend, setDefaultCountryCode, type ContactsBackend, type NativeContact } from '../tools/contacts';
import { installPreferencesStore } from '../tools/memory';
import { getPreferencesStore } from '../store/preferencesStore';
import { getSettingsStore } from '../store/settingsStore';
import { getVaultStore } from '../store/vaultStore';
import { NexusError, type Provider, type Result, err, ok } from '../types/auth';
import { logEvent, logError } from '../utils/logger';

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

/** Mark a provider disconnected from inside the apiClient on refresh failure. */
const handleDisconnect = (provider: NexusHttpProvider): void => {
  // The apiClient only refreshes 'google'; openai falls through here too
  // for symmetry. Both map cleanly onto vaultStore.markDisconnected.
  getVaultStore().getState().markDisconnected(provider as Provider);
};

export const bootstrap = async (): Promise<Result<void, NexusError>> => {
  // Step 1.
  const dbResult = await initializeDatabase();
  if (!dbResult.ok) {
    logError('boot_db_failed', {});
    return err(dbResult.error);
  }
  // Step 2.
  const prefsResult = await getPreferencesStore().getState().hydrateFromDb();
  if (!prefsResult.ok) {
    logError('boot_prefs_failed', {});
    return err(prefsResult.error);
  }
  // Step 3.
  const vaultResult = await getVaultStore().getState().hydrate();
  if (!vaultResult.ok) {
    logError('boot_vault_failed', {});
    return err(vaultResult.error);
  }
  // Step 4.
  const settingsResult = await getSettingsStore().getState().hydrateFromDb();
  if (!settingsResult.ok) {
    logError('boot_settings_failed', {});
    return err(settingsResult.error);
  }
  // Step 5. apiClient only needs google refresh today; the RefreshFn
  // type is provider-generic so future providers don't widen the call site.
  const refreshAdapter: RefreshFn = async (provider) => {
    if (provider !== 'google') {
      return err(new NexusError('SESSION_EXPIRED', `${provider} cannot be refreshed.`));
    }
    return refreshAccessToken('google');
  };
  installApiClientDeps({
    refresh: refreshAdapter,
    onDisconnected: handleDisconnect,
  });
  // Step 6.
  installOAuthBackend(buildAppAuthBackend());
  // Step 7.
  installContactsBackend(buildContactsBackend());
  // Step 8.
  installPreferencesStore(getPreferencesStore());
  // Step 9.
  const country = getSettingsStore().getState().defaultCountryCode;
  setDefaultCountryCode(country);

  logEvent('boot_complete', {});
  return ok(undefined);
};
