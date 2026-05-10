/**
 * Auth store — Marcus-style facade over vaultStore + oauthService.
 *
 * vaultStore owns the canonical connection-state snapshot. authStore
 * exposes the action triplet the Marcus spec calls for —
 * `connectGoogle(clientId)`, `disconnectGoogle()`, `checkConnection()` —
 * and forwards them to vaultStore + oauthService so the screens have a
 * single, narrow API to talk to.
 *
 * The store does not duplicate the connection snapshot. Selectors that
 * need to read it should subscribe to `vaultStore` directly.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';

import * as oauthService from '../services/oauthService';
import { type Provider } from '../types/auth';
import { type NexusError, type Result } from '../types/auth';
import { logEvent } from '../utils/logger';

import { type VaultState, getVaultStore as getDefaultVaultStore } from './vaultStore';

interface AuthDeps {
  /**
   * Reader for the live vault store. Defaulting to the singleton means
   * production code stays trivial; tests can pass a custom store created
   * via `createVaultStore()` to keep state isolated.
   */
  readonly getVaultStore: () => StoreApi<VaultState>;
}

interface AuthStateData {
  readonly connecting: boolean;
  readonly disconnecting: boolean;
  readonly lastError: NexusError | null;
}

interface AuthActions {
  connectGoogle: (clientId: string) => Promise<Result<{ email: string | null }, NexusError>>;
  disconnectGoogle: () => Promise<Result<void, NexusError>>;
  checkConnection: () => Promise<Result<void, NexusError>>;
}

export type AuthState = AuthStateData & AuthActions;

const initial = (): AuthStateData => ({
  connecting: false,
  disconnecting: false,
  lastError: null,
});

export const createAuthStore = (deps: AuthDeps = { getVaultStore: getDefaultVaultStore }): StoreApi<AuthState> =>
  createStore<AuthState>((set) => ({
    ...initial(),

    connectGoogle: async (clientId) => {
      set({ connecting: true, lastError: null });
      const result = await oauthService.connect('google', clientId);
      if (!result.ok) {
        set({ connecting: false, lastError: result.error });
        return result;
      }
      deps.getVaultStore().getState().markConnected('google', result.value.email);
      logEvent('auth_connected', { provider: 'google' });
      set({ connecting: false, lastError: null });
      return result;
    },

    disconnectGoogle: async () => {
      set({ disconnecting: true, lastError: null });
      const result = await oauthService.disconnect('google' as Provider);
      if (!result.ok) {
        set({ disconnecting: false, lastError: result.error });
        return result;
      }
      deps.getVaultStore().getState().markDisconnected('google');
      logEvent('auth_disconnected', { provider: 'google' });
      set({ disconnecting: false, lastError: null });
      return result;
    },

    checkConnection: async () => {
      const result = await deps.getVaultStore().getState().hydrate();
      return result;
    },
  }));

let singleton: StoreApi<AuthState> | null = null;
export const getAuthStore = (): StoreApi<AuthState> => {
  if (singleton === null) singleton = createAuthStore();
  return singleton;
};

export const __resetForTests = (): void => {
  singleton = null;
};
