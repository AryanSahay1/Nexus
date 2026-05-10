/**
 * Builds the dynamic system prompt that prefaces every agent turn.
 *
 * Pure function. Inputs:
 *   - `now`: current Date (so the LLM knows the user's current time)
 *   - `timezone`: IANA timezone string (e.g. 'Asia/Kolkata')
 *   - `preferences`: flat key/value map from preferencesStore.snapshot
 *   - `connectedProviders`: list of currently connected providers
 *
 * Output: the canonical `system` message content per the engineering
 * directive. Deterministic for fixed inputs (locked by unit test).
 */

import { type Provider } from '../types/auth';

/**
 * Light user identity passed into the prompt so the agent can address
 * the user by name or email when natural. The fields are independent
 * (some users connect Google but never share a profile name; some use
 * the OpenAI key path only and have no email at all).
 */
export interface SystemPromptUser {
  readonly email: string | null;
  readonly displayName: string | null;
}

export interface SystemPromptInput {
  readonly now: Date;
  readonly timezone: string;
  readonly preferences: Readonly<Record<string, string>>;
  readonly connectedProviders: readonly Provider[];
  readonly user?: SystemPromptUser;
}

const formatNow = (now: Date, timezone: string): string => {
  // Intl.DateTimeFormat is available in modern Hermes/Node. We pin
  // the long-form weekday + day + month + year + 24h time so the LLM
  // has unambiguous temporal grounding.
  const fmt = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  return fmt.format(now);
};

const formatPreferences = (prefs: Readonly<Record<string, string>>): string => {
  const keys = Object.keys(prefs).sort();
  if (keys.length === 0) return '  (no preferences set)';
  return keys.map((k) => `  - ${k}: ${prefs[k]}`).join('\n');
};

const formatConnections = (providers: readonly Provider[]): string => {
  if (providers.length === 0) return '  (none — ask the user to connect a service in the Vault)';
  const labels: Record<Provider, string> = {
    google: 'Gmail + Google Calendar',
    whatsapp: 'WhatsApp',
    openai: 'OpenAI',
  };
  return providers.map((p) => `  - ${labels[p]}`).join('\n');
};

const BASE = `You are Nexus, a personal AI agent that runs on the user's mobile device. You operate on their digital life through a set of tools — Gmail, Google Calendar, contacts, and (later) WhatsApp. Be professional, helpful, and concise. Never invent information; call tools to get the truth.`;

const RULES = [
  'Rules:',
  '- ALWAYS confirm before sending messages, sending email, or creating events. The runtime will surface a confirmation card to the user — your job is to present the drafted action clearly.',
  '- If a tool returns an error, apologize, explain the failure in plain language, and suggest the next step (e.g. "reconnect Google in the Vault", "try again in a moment", or "check the recipient address").',
  '- When the user mentions a person by name (e.g. "send X to my brother"), call system_contacts_search FIRST to resolve the phone number or email before calling the messaging tool.',
  '- Times are interpreted in the timezone shown above unless the user gives an explicit one.',
];

const formatUser = (user: SystemPromptUser | undefined): string | null => {
  if (!user) return null;
  const parts: string[] = [];
  if (user.displayName !== null && user.displayName.length > 0) {
    parts.push(`Name: ${user.displayName}`);
  }
  if (user.email !== null && user.email.length > 0) {
    parts.push(`Email: ${user.email}`);
  }
  if (parts.length === 0) return null;
  return parts.map((p) => `  - ${p}`).join('\n');
};

export const build = (input: SystemPromptInput): string => {
  const sections: string[] = [
    BASE,
    `Current time: ${formatNow(input.now, input.timezone)} (${input.timezone})`,
  ];
  const userBlock = formatUser(input.user);
  if (userBlock !== null) {
    sections.push('User identity:');
    sections.push(userBlock);
  }
  sections.push('User preferences:');
  sections.push(formatPreferences(input.preferences));
  sections.push('Connected services:');
  sections.push(formatConnections(input.connectedProviders));
  sections.push(RULES.join('\n'));
  return sections.join('\n\n');
};
