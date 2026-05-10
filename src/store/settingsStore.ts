/**
 * Settings store — AI provider configuration + UX toggles.
 *
 * Backed by the same `user_preferences` SQLite table the rest of the app
 * uses. Every write is flush-through: SecureStore for the API key,
 * preferencesRepo for everything else. The Settings screen's TextInput
 * onBlur handlers and the provider-preset taps go through these actions.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';

import * as preferencesRepo from '../db/preferencesRepo';
import * as tokenService from '../services/tokenService';
import { type NexusError, type Result } from '../types/auth';
import {
  PROVIDER_PROFILES,
  SETTINGS_DEFAULTS,
  SETTINGS_KEYS,
  type AiProviderProfile,
  type SettingsState,
} from '../types/settings';

interface SettingsStateData extends SettingsState {
  readonly hydrating: boolean;
  readonly lastError: NexusError | null;
}

interface SettingsActions {
  hydrateFromDb: () => Promise<Result<void, NexusError>>;
  setBaseUrl: (value: string) => Promise<Result<void, NexusError>>;
  setModel: (value: string) => Promise<Result<void, NexusError>>;
  setTemperature: (value: number) => Promise<Result<void, NexusError>>;
  setHapticsEnabled: (value: boolean) => Promise<Result<void, NexusError>>;
  setStreamingEnabled: (value: boolean) => Promise<Result<void, NexusError>>;
  setDefaultCountryCode: (value: string | null) => Promise<Result<void, NexusError>>;
  applyProviderProfile: (profile: AiProviderProfile) => Promise<Result<void, NexusError>>;
  setOpenAiApiKey: (value: string) => Promise<Result<void, NexusError>>;
  clearOpenAiApiKey: () => Promise<Result<void, NexusError>>;
}

export type SettingsStateFull = SettingsStateData & SettingsActions;

const initial = (): SettingsStateData => ({
  ...SETTINGS_DEFAULTS,
  hydrating: false,
  lastError: null,
});

const parseTemperature = (raw: string): number => {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return SETTINGS_DEFAULTS.temperature;
  if (n < 0) return 0;
  if (n > 2) return 2;
  return n;
};

const parseBool = (raw: string): boolean => raw === 'true';

export const createSettingsStore = (): StoreApi<SettingsStateFull> =>
  createStore<SettingsStateFull>((set, get) => ({
    ...initial(),

    hydrateFromDb: async () => {
      set({ hydrating: true, lastError: null });
      const result = await preferencesRepo.listAll();
      if (!result.ok) {
        set({ hydrating: false, lastError: result.error });
        return result;
      }
      const next: { -readonly [K in keyof SettingsState]?: SettingsState[K] } = {};
      for (const row of result.value) {
        switch (row.key) {
          case SETTINGS_KEYS.AI_BASE_URL:
            next.baseUrl = row.value;
            break;
          case SETTINGS_KEYS.AI_MODEL:
            next.model = row.value;
            break;
          case SETTINGS_KEYS.AI_TEMPERATURE:
            next.temperature = parseTemperature(row.value);
            break;
          case SETTINGS_KEYS.HAPTICS_ENABLED:
            next.hapticsEnabled = parseBool(row.value);
            break;
          case SETTINGS_KEYS.STREAMING_ENABLED:
            next.streamingEnabled = parseBool(row.value);
            break;
          case SETTINGS_KEYS.DEFAULT_COUNTRY_CODE:
            next.defaultCountryCode = row.value.length > 0 ? row.value : null;
            break;
          default:
            break;
        }
      }
      set({ ...get(), ...next, hydrating: false });
      return { ok: true, value: undefined };
    },

    setBaseUrl: async (value) => {
      const trimmed = value.trim();
      const result = await preferencesRepo.upsert(
        SETTINGS_KEYS.AI_BASE_URL,
        trimmed.length > 0 ? trimmed : SETTINGS_DEFAULTS.baseUrl,
        'behavior',
      );
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ baseUrl: result.value.value, lastError: null });
      return { ok: true, value: undefined };
    },

    setModel: async (value) => {
      const trimmed = value.trim();
      const result = await preferencesRepo.upsert(
        SETTINGS_KEYS.AI_MODEL,
        trimmed.length > 0 ? trimmed : SETTINGS_DEFAULTS.model,
        'behavior',
      );
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ model: result.value.value, lastError: null });
      return { ok: true, value: undefined };
    },

    setTemperature: async (value) => {
      const clamped = Math.min(2, Math.max(0, value));
      const result = await preferencesRepo.upsert(
        SETTINGS_KEYS.AI_TEMPERATURE,
        clamped.toString(),
        'behavior',
      );
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ temperature: clamped, lastError: null });
      return { ok: true, value: undefined };
    },

    setHapticsEnabled: async (value) => {
      const result = await preferencesRepo.upsert(
        SETTINGS_KEYS.HAPTICS_ENABLED,
        value ? 'true' : 'false',
        'behavior',
      );
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ hapticsEnabled: value, lastError: null });
      return { ok: true, value: undefined };
    },

    setStreamingEnabled: async (value) => {
      const result = await preferencesRepo.upsert(
        SETTINGS_KEYS.STREAMING_ENABLED,
        value ? 'true' : 'false',
        'behavior',
      );
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ streamingEnabled: value, lastError: null });
      return { ok: true, value: undefined };
    },

    setDefaultCountryCode: async (value) => {
      if (value === null || value.length === 0) {
        const removeResult = await preferencesRepo.deleteByKey(SETTINGS_KEYS.DEFAULT_COUNTRY_CODE);
        if (!removeResult.ok) {
          set({ lastError: removeResult.error });
          return removeResult;
        }
        set({ defaultCountryCode: null, lastError: null });
        return { ok: true, value: undefined };
      }
      const result = await preferencesRepo.upsert(
        SETTINGS_KEYS.DEFAULT_COUNTRY_CODE,
        value,
        'communication',
      );
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      set({ defaultCountryCode: value, lastError: null });
      return { ok: true, value: undefined };
    },

    applyProviderProfile: async (profile) => {
      if (profile.id !== 'custom') {
        const baseResult = await get().setBaseUrl(profile.baseUrl);
        if (!baseResult.ok) return baseResult;
        const modelResult = await get().setModel(profile.defaultModel);
        if (!modelResult.ok) return modelResult;
      }
      return { ok: true, value: undefined };
    },

    setOpenAiApiKey: async (value) => {
      const result = await tokenService.setToken('openai', 'apiKey', value);
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      return { ok: true, value: undefined };
    },

    clearOpenAiApiKey: async () => {
      const result = await tokenService.deleteToken('openai', 'apiKey');
      if (!result.ok) {
        set({ lastError: result.error });
        return result;
      }
      return { ok: true, value: undefined };
    },
  }));

let singleton: StoreApi<SettingsStateFull> | null = null;
export const getSettingsStore = (): StoreApi<SettingsStateFull> => {
  if (singleton === null) singleton = createSettingsStore();
  return singleton;
};

export const __resetForTests = (): void => {
  singleton = null;
};

/** Convenience: which provider profile is currently active given a base URL. */
export const detectActiveProfile = (baseUrl: string): AiProviderProfile['id'] => {
  for (const p of PROVIDER_PROFILES) {
    if (p.id !== 'custom' && p.baseUrl === baseUrl) return p.id;
  }
  return 'custom';
};
