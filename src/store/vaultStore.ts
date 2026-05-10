/**
 * Vault store — Zustand state for the connected-providers surface.
 *
 * Holds the latest snapshot retrieved from `tokenService.getAllConnectedProviders`
 * plus the in-flight state of any connect/disconnect operation. The Vault
 * screen pulls from this store and triggers refreshes through `refresh()`.
 */

import { create } from 'zustand';

import * as tokenService from '../services/tokenService';
import type { Provider, VaultSnapshot } from '../types/auth';

export interface VaultStore {
  readonly snapshot: VaultSnapshot | null;
  readonly isRefreshing: boolean;
  readonly busyProvider: Provider | null;
  readonly errorMessage: string | null;
  refresh: () => Promise<void>;
  setBusy: (provider: Provider | null) => void;
  setError: (message: string | null) => void;
}

export const useVaultStore = create<VaultStore>((set) => ({
  snapshot: null,
  isRefreshing: false,
  busyProvider: null,
  errorMessage: null,
  refresh: async () => {
    set({ isRefreshing: true, errorMessage: null });
    const result = await tokenService.getAllConnectedProviders();
    if (result.ok) {
      set({ snapshot: result.value, isRefreshing: false });
    } else {
      set({ isRefreshing: false, errorMessage: result.error.message });
    }
  },
  setBusy: (provider) => set({ busyProvider: provider }),
  setError: (message) => set({ errorMessage: message }),
}));
