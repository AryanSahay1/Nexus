/**
 * User-facing settings — AI provider configuration + UX toggles.
 *
 * Persisted as user_preferences rows under a stable set of keys.
 * Every field maps to a documented preference key so the same value
 * is read by both the Settings UI and the systemPrompt builder.
 */

/** Stable preference keys this module owns. */
export const SETTINGS_KEYS = {
  AI_BASE_URL: 'ai_base_url',
  AI_MODEL: 'ai_model',
  AI_TEMPERATURE: 'ai_temperature',
  HAPTICS_ENABLED: 'haptics_enabled',
  STREAMING_ENABLED: 'streaming_enabled',
  DEFAULT_COUNTRY_CODE: 'default_country_code',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Built-in provider profiles offered by the Settings UI as quick-pick chips. */
export interface AiProviderProfile {
  readonly id: 'openai' | 'groq' | 'custom';
  readonly label: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly description: string;
}

export const PROVIDER_PROFILES: readonly AiProviderProfile[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    description: 'Cheap, capable, and the default. Pay as you go.',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama3-8b-8192',
    description: 'Free tier with very fast inference.',
  },
  {
    id: 'custom',
    label: 'Custom',
    baseUrl: '',
    defaultModel: '',
    description: 'Any OpenAI-compatible endpoint (e.g. local Ollama).',
  },
];

/** In-memory shape of the resolved settings values. */
export interface SettingsState {
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly hapticsEnabled: boolean;
  readonly streamingEnabled: boolean;
  readonly defaultCountryCode: string | null;
}

/** Defaults applied when the database has no row for a given key. */
export const SETTINGS_DEFAULTS: SettingsState = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  hapticsEnabled: true,
  streamingEnabled: false,
  defaultCountryCode: null,
};
