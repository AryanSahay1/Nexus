/**
 * Memory tools — read/write the local user_preferences table that the
 * systemPrompt builder reads on every turn. These are how the agent
 * gives the user a sense that "Nexus remembers what matters".
 *
 * All three tools are non-destructive (no LLM-driven destructive writes
 * to a third-party service).
 */

import { type StoreApi } from 'zustand/vanilla';

import { type PreferenceCategory, type UserPreference } from '../db/preferencesRepo';
import { type PreferencesState } from '../store/preferencesStore';
import { NexusError, type Result, err, ok } from '../types/auth';

let preferencesStoreRef: StoreApi<PreferencesState> | null = null;

/** Bind the memory tools to the live preferences store at boot. */
export const installPreferencesStore = (store: StoreApi<PreferencesState>): void => {
  preferencesStoreRef = store;
};

const getStore = (): Result<StoreApi<PreferencesState>, NexusError> => {
  if (preferencesStoreRef === null) {
    return err(new NexusError('UNKNOWN', 'memory tools: preferences store not installed.'));
  }
  return ok(preferencesStoreRef);
};

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'communication',
  'contacts',
  'behavior',
]);

// ── remember_fact ---------------------------------------------------------

export interface RememberFactParams {
  readonly key: string;
  readonly value: string;
  readonly category: PreferenceCategory;
}

export const parseRememberFactParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<RememberFactParams, NexusError> => {
  const key = raw['key'];
  const value = raw['value'];
  const category = raw['category'] ?? 'behavior';
  if (typeof key !== 'string' || key.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'remember_fact: key is required.'));
  }
  if (typeof value !== 'string') {
    return err(new NexusError('INVALID_INPUT', 'remember_fact: value must be a string.'));
  }
  if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
    return err(
      new NexusError(
        'INVALID_INPUT',
        "remember_fact: category must be 'communication', 'contacts', or 'behavior'.",
      ),
    );
  }
  return ok({ key: key.trim(), value, category: category as PreferenceCategory });
};

export const rememberFact = async (
  params: RememberFactParams,
): Promise<Result<UserPreference, NexusError>> => {
  const store = getStore();
  if (!store.ok) return err(store.error);
  return store.value.getState().set(params.key, params.value, params.category);
};

// ── recall_fact -----------------------------------------------------------

export interface RecallFactParams {
  readonly key: string;
}

export const parseRecallFactParams = (
  raw: Readonly<Record<string, unknown>>,
): Result<RecallFactParams, NexusError> => {
  const key = raw['key'];
  if (typeof key !== 'string' || key.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'recall_fact: key is required.'));
  }
  return ok({ key: key.trim() });
};

export const recallFact = async (
  params: RecallFactParams,
): Promise<Result<{ key: string; value: string | null }, NexusError>> => {
  const store = getStore();
  if (!store.ok) return err(store.error);
  const value = store.value.getState().snapshot[params.key];
  return ok({ key: params.key, value: typeof value === 'string' ? value : null });
};

// ── list_memories ---------------------------------------------------------

export const parseListMemoriesParams = (
  _raw: Readonly<Record<string, unknown>>,
): Result<Record<string, never>, NexusError> => ok({});

export const listMemories = async (): Promise<
  Result<{ entries: readonly { key: string; value: string; category: string }[] }, NexusError>
> => {
  const store = getStore();
  if (!store.ok) return err(store.error);
  const entries = store.value.getState().entries.map((p) => ({
    key: p.key,
    value: p.value,
    category: p.category,
  }));
  return ok({ entries });
};

/** Test-only: clear the bound store. */
export const __resetForTests = (): void => {
  preferencesStoreRef = null;
};
