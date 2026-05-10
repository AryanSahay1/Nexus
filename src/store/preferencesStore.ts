/**
 * Preferences store — in-memory mirror of the `user_preferences` table.
 *
 * Hydrated at boot. Read by `systemPrompt.build()` on every agent turn.
 * Writes are flush-through: every mutation immediately persists via
 * `preferencesRepo` and updates in-memory state on success.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';

import * as preferencesRepo from '../db/preferencesRepo';
import { type PreferenceCategory, type UserPreference } from '../db/preferencesRepo';
import { type NexusError, type Result } from '../types/auth';

interface PreferencesStateData {
  readonly entries: readonly UserPreference[];
  readonly snapshot: Readonly<Record<string, string>>;
  readonly hydrating: boolean;
  readonly lastError: NexusError | null;
}

interface PreferencesActions {
  hydrateFromDb: () => Promise<Result<void, NexusError>>;
  set: (
    key: string,
    value: string,
    category: PreferenceCategory,
  ) => Promise<Result<UserPreference, NexusError>>;
  remove: (key: string) => Promise<Result<void, NexusError>>;
  clearAll: () => Promise<Result<void, NexusError>>;
}

export type PreferencesState = PreferencesStateData & PreferencesActions;

const buildSnapshot = (entries: readonly UserPreference[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const e of entries) out[e.key] = e.value;
  return out;
};

const initial = (): PreferencesStateData => ({
  entries: [],
  snapshot: {},
  hydrating: false,
  lastError: null,
});

export const createPreferencesStore = (): StoreApi<PreferencesState> =>
  createStore<PreferencesState>((set, get) => ({
    ...initial(),

    hydrateFromDb: async () => {
      set({ hydrating: true, lastError: null });
      const result = await preferencesRepo.listAll();
      if (result.ok) {
        set({
          entries: result.value,
          snapshot: buildSnapshot(result.value),
          hydrating: false,
        });
        return { ok: true, value: undefined };
      }
      set({ hydrating: false, lastError: result.error });
      return result;
    },

    set: async (key, value, category) => {
      const result = await preferencesRepo.upsert(key, value, category);
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      const next: UserPreference[] = [];
      let replaced = false;
      for (const entry of get().entries) {
        if (entry.key === key) {
          next.push(result.value);
          replaced = true;
        } else {
          next.push(entry);
        }
      }
      if (!replaced) next.push(result.value);
      set({ entries: next, snapshot: buildSnapshot(next), lastError: null });
      return result;
    },

    remove: async (key) => {
      const result = await preferencesRepo.deleteByKey(key);
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      const next = get().entries.filter((e) => e.key !== key);
      set({ entries: next, snapshot: buildSnapshot(next), lastError: null });
      return { ok: true, value: undefined };
    },

    clearAll: async () => {
      const result = await preferencesRepo.clear();
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ entries: [], snapshot: {}, lastError: null });
      return { ok: true, value: undefined };
    },
  }));

let singleton: StoreApi<PreferencesState> | null = null;
export const getPreferencesStore = (): StoreApi<PreferencesState> => {
  if (singleton === null) singleton = createPreferencesStore();
  return singleton;
};

export const __resetForTests = (): void => {
  singleton = null;
};
