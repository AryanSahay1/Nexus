/**
 * Vault store — connected services snapshot.
 *
 * Hydrates from `tokenService.getAllConnectedProviders` at boot. The
 * onboarding gate in `app/_layout.tsx` reads `hasAnyConnection()` /
 * `openAiConfigured` to decide whether to redirect to /vault.
 *
 * This module is implemented with Zustand's vanilla `createStore` so
 * the same store can drive React components in the app and pure node
 * unit tests without booting RN.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';

import * as tokenService from '../services/tokenService';
import { type NexusError, type Provider, type Result, type VaultSnapshot } from '../types/auth';
import { logEvent } from '../utils/logger';

interface VaultStateData {
  readonly snapshot: VaultSnapshot;
  readonly hydrating: boolean;
  readonly lastError: NexusError | null;
}

const emptyConnection = (provider: Provider): VaultSnapshot[Provider] => ({
  provider,
  status: 'disconnected',
  userEmail: null,
  tokenExpiresAt: null,
});

const initial = (): VaultStateData => ({
  snapshot: {
    google: emptyConnection('google'),
    whatsapp: emptyConnection('whatsapp'),
    openai: emptyConnection('openai'),
  },
  hydrating: false,
  lastError: null,
});

interface VaultActions {
  hydrate: () => Promise<Result<void, NexusError>>;
  markConnected: (provider: Provider, userEmail?: string | null) => void;
  markDisconnected: (provider: Provider) => void;
}

export type VaultState = VaultStateData & VaultActions;

export const createVaultStore = (): StoreApi<VaultState> =>
  createStore<VaultState>((set, get) => ({
    ...initial(),

    hydrate: async () => {
      set({ hydrating: true, lastError: null });
      const result = await tokenService.getAllConnectedProviders();
      if (result.ok) {
        set({ snapshot: result.value, hydrating: false });
        const connected = (Object.values(result.value) as VaultSnapshot[Provider][]).filter(
          (c) => c.status === 'connected',
        ).length;
        logEvent('vault_hydrated', { connected_providers_count: connected });
        return { ok: true, value: undefined };
      }
      set({ hydrating: false, lastError: result.error });
      return result;
    },

    markConnected: (provider, userEmail = null) => {
      const { snapshot } = get();
      set({
        snapshot: {
          ...snapshot,
          [provider]: {
            provider,
            status: 'connected' as const,
            userEmail,
            tokenExpiresAt: null,
          },
        },
      });
      logEvent('vault_marked_connected', { provider });
    },

    markDisconnected: (provider) => {
      const { snapshot } = get();
      set({
        snapshot: {
          ...snapshot,
          [provider]: emptyConnection(provider),
        },
      });
      logEvent('vault_marked_disconnected', { provider });
    },
  }));

/** Lazily-instantiated app-wide singleton. */
let singleton: StoreApi<VaultState> | null = null;
export const getVaultStore = (): StoreApi<VaultState> => {
  if (singleton === null) singleton = createVaultStore();
  return singleton;
};

/** Convenience selectors used by the onboarding gate. */
export const hasAnyConnection = (state: VaultState): boolean => {
  return (Object.values(state.snapshot) as VaultSnapshot[Provider][]).some(
    (c) => c.status === 'connected',
  );
};
export const isOpenAiConfigured = (state: VaultState): boolean =>
  state.snapshot.openai.status === 'connected';

/** Test-only: blow away the singleton between tests. */
export const __resetForTests = (): void => {
  singleton = null;
};
