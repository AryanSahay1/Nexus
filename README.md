# Nexus

> **Two builds live in this repo. Pick the one for your phone:**
>
> | Phone | Build | APK |
> |---|---|---|
> | **Vivo V27 / FunTouch OS** (or anything on which the React Native release crashed on launch) | **Native Kotlin / Jetpack Compose** | [`v2.0.0-android-native`](https://github.com/AryanSahay1/Nexus/releases/tag/v2.0.0-android-native) — 2.20 MB, runs natively without the React Native bridge |
> | Anything else (Pixel, Samsung One UI, MIUI, etc.) | **React Native / Expo SDK 50** | [`v1.0.3`](https://github.com/AryanSahay1/Nexus/releases/tag/v1.0.3) — 38 MB, the original codebase documented below |
>
> Source for the native build: branch [`cursor/native-android-nexus-358a`](https://github.com/AryanSahay1/Nexus/tree/cursor/native-android-nexus-358a) (PR #13). Source for the React Native build: this `main` branch.

---

> Your local-first AI agent that lives on your device, knows your Gmail, reads your calendar, remembers what matters, and asks before it acts.

Built with Expo SDK 50 + React Native + strict TypeScript. **All credentials live in the device's secure enclave (Keychain / Keystore) — no token, key, or message body ever leaves the phone except as the literal payload of a Google or OpenAI API call you authorized.**

---

## What it does

You open the app. The Vault screen tells you what's connected. You connect Google **once** through the in-app browser (PKCE OAuth). You paste your OpenAI key (or point it at Groq, or local Ollama). You return to chat and type:

- *"Read my latest email."*
- *"What's on my calendar this week?"*
- *"Email Sarah at sarah@example.com saying I'll be 10 minutes late."*
- *"Remember that I prefer dark mode."*

Nexus thinks, calls the right tools, and shows you the answer. **Every send / create / delete asks you first** — a confirmation card slides up, you confirm or cancel, and the agent loop resumes.

There is no third-party server. There is no telemetry. The chat history, the saved facts, the tokens — they live on your phone, in SQLite and the secure enclave.

---

## The eight laws

1. **Security first.** Every credential goes to `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility. Never AsyncStorage. Never a JSON file.
2. **Zero PII in logs.** The logger has a small allowlist of safe field names and runs a regex scrub for emails, bearer tokens, `sk-…` keys, and E.164 phone numbers as a last-line defense.
3. **No `any` ever.** Strict TypeScript with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. ESLint enforces `@typescript-eslint/no-explicit-any: error`.
4. **`Result` everywhere.** Service functions return `Result<T, NexusError>`; nothing throws across module boundaries.
5. **`setOAuthBundle` is the only door.** OAuth tokens enter SecureStore through one atomic, rollback-safe writer.
6. **No TODOs, no stubs, no placeholders.** Every function is complete and handles every error path.
7. **Forward-only migrations.** SQLite schemas grow; never shrink. PRAGMA `user_version` tracks them.
8. **Tests before moving on.** Every service ships with a test file ≥ 10 unit tests, mocking only at the system boundary.

---

## Architecture

Built bottom-up, no circular dependencies, one layer at a time:

```
app/                                 ⟵ expo-router screens
  _layout.tsx                          font loader, splash gate, ErrorBoundary, Stack
  (tabs)/_layout.tsx                   custom 4-tab bar with Reanimated indicator
  (tabs)/index.tsx                     Chat (FlashList, ConfirmationSheet, suggestions)
  (tabs)/vault.tsx                     Connect Google + paste OpenAI key
  (tabs)/memory.tsx                    Saved facts + add-a-memory form
  (tabs)/settings.tsx                  Provider chips, model, temp, toggles, danger zone
  auth/connect.tsx                     OAuth progress modal

src/
  types/                             ⟵ pure type declarations
    auth.ts          Result, NexusError, Provider, ServiceConnection, …
    agent.ts         Message, ToolCall, AgentStatus, PendingAction, ToolResult
    tools.ts         per-tool param + result shapes
    google.ts        EmailThread, EmailDetail, DriveFile, DriveDocContent
    settings.ts      SETTINGS_KEYS, PROVIDER_PROFILES, SettingsState

  utils/
    logger.ts        privacy-safe structured logger (allowlist + PII regex)
    phoneNumber.ts   E.164 validator + normalizer

  db/
    schema.sql       authoritative schema reference
    database.ts      single connection, forward-only migrations
    preferencesRepo  CRUD for user_preferences

  services/
    tokenService.ts  the only credential I/O surface (PR #1+#2 foundation)
    apiClient.ts     shared Axios with 401 refresh + concurrent dedupe
    oauthService.ts  Google PKCE config, connect/disconnect, refresh
    openaiService.ts chat completions + Whisper + apiKey validator
    googleService.ts Gmail (list + send + read-by-id + search) + Calendar
                     (create + next) + Drive (list + export-as-text)
    bootstrap.ts     wires every install* point at app boot

  store/                             ⟵ Zustand vanilla stores
    chatStore.ts        messages, agent status FSM, pendingAction
    vaultStore.ts       provider connection snapshot, hydrated from SecureStore
    preferencesStore.ts in-memory mirror of user_preferences
    settingsStore.ts    AI provider config, UX toggles
    authStore.ts        thin facade (connectGoogle, disconnectGoogle, checkConnection)

  agent/
    toolRegistry.ts  12 tool definitions, single source of truth, isDestructive flag
    toolExecutor.ts  always returns ToolResult, never throws
    systemPrompt.ts  pure builder injecting clock + prefs + connected services
    agentLoop.ts     recursive turn engine with iteration cap, confirmation pause

  tools/
    gmail.ts         read_recent, send_email, search, read_email
    googleCalendar.ts create_event, get_next
    contacts.ts      system_contacts_search (permission-aware)
    drive.ts         list_recent, read_doc
    memory.ts        remember_fact, recall_fact, list_memories

  hooks/
    useAgentLoop.ts  React adapter that builds the AgentDeps from the stores
    useConfirmation.ts module-level Promise resolver pair
    useHaptics.ts    expo-haptics wrapper gated on settingsStore

  components/
    shared/{ClawPanel,GlowButton,StatusPill,ErrorBoundary,LoadingSpinner}
    chat/{MessageBubble,TypingIndicator,ConfirmationSheet,
          ToolExecutionBadge,EmailCard,CalendarEventCard}
    vault/ServiceCard

  theme/index.ts     full design system (colors, fonts, spacing, claw geometry, animation)

__tests__/unit/                      ⟵ 17 test suites, 257+ tests
docs/
  GOOGLE_SETUP.md                    free 10-minute Google Cloud setup walk-through
  SITUATION_ASSESSMENT.md            TPM cycle artifact
  GAP_REGISTER_{1,2}.md              gap analysis
  PRD_CYCLE_{1,2}.md                 functional PRDs
  FINAL_VERIFICATION_REPORT.md       certification statement
```

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/AryanSahay1/Nexus
cd Nexus
npm install --legacy-peer-deps
```

### 2. Google client ID (free, 10 minutes)

Follow [`docs/GOOGLE_SETUP.md`](./docs/GOOGLE_SETUP.md) once to create an OAuth 2.0 Client ID. Then:

```bash
cp .env.example .env
# Open .env and paste your client ID
# EXPO_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

### 3. AI provider

In `.env`, choose one:

```bash
# OpenAI (default — pay-as-you-go)
EXPO_PUBLIC_OPENAI_BASE_URL=https://api.openai.com/v1
EXPO_PUBLIC_OPENAI_MODEL=gpt-4o-mini

# Groq (free tier, very fast)
# EXPO_PUBLIC_OPENAI_BASE_URL=https://api.groq.com/openai/v1
# EXPO_PUBLIC_OPENAI_MODEL=llama3-8b-8192

# Local Ollama
# EXPO_PUBLIC_OPENAI_BASE_URL=http://localhost:11434/v1
```

Your API key never goes in `.env` — paste it into the in-app Vault screen at runtime, where it's written straight to the secure enclave.

### 4. Run

```bash
npx expo start
# Press i for iOS simulator, a for Android emulator
```

---

## Development workflow

```bash
npx tsc --noEmit                                    # strict type check
npx eslint src __tests__ app --ext .ts,.tsx --max-warnings 0
npx jest                                            # full unit suite
```

All three must exit 0 before any commit. CI gates the same way.

The project also has security-property gates that any contributor should run before opening a PR:

```bash
rg "AsyncStorage" src       # must return zero hits — LAW 1
rg "console.log" src        # must return zero hits — LAW 2 (logger only)
rg ": any" src              # must return zero hits — LAW 3
rg "TODO|FIXME" src         # must return zero hits — LAW 6
```

---

## Troubleshooting

### Red screen: "Unable to load script. Make sure you're either running Metro …"

You sideloaded the **debug** APK. Debug APKs in Expo SDK 50 do not bundle JavaScript; they expect a Metro dev server (`npx expo start`) at runtime. Two fixes:

- **Easiest** — uninstall, then download `nexus-<version>-android-release.apk` from the same GitHub Release page. The release APK bundles the JS and runs standalone. As of v0.1.3 the debug APK is no longer attached to public Releases for exactly this reason.
- **For developers** — keep the debug APK installed, run `npx expo start` from the repo root, and let the device connect to Metro on the same network.

### Boot-failed screen with a step name and error code

The boot sequence has a hardened `BootSequencer` (`src/utils/bootSequencer.ts`) that surfaces the failing step name and `NexusErrorCode` directly on screen. Common cases:

| Step | Likely cause |
| --- | --- |
| `db_init` | Insufficient storage on device, or running a build older than v0.1.2 (the `expo-sqlite/next` API switch was made there). |
| `vault_hydrate` | iOS Keychain / Android Keystore briefly unavailable. Tap Retry — usually self-heals. |
| `oauth_backend` / `contacts_backend` | These are non-critical. They can fail without blocking the rest of the app. |

Tap **Retry** on the boot-failed screen to re-run the entire boot sequence without reinstalling.

### TypeScript errors on `npx tsc --noEmit`

`tsconfig.json` is strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Both flags are non-negotiable per LAW 3 — if your edit produces an error, the type is wrong, not the config. Use `unknown` + a type guard rather than `any`.

### `babel.config.js` and `expo-router/babel`

In SDK 50 the `expo-router/babel` plugin is **deprecated** and folded into `babel-preset-expo`. Re-adding it produces:

```
SyntaxError: [BABEL]: expo-router/babel is deprecated in favor of babel-preset-expo in SDK 50.
```

at release-bundle build time. The current `babel.config.js` correctly omits it. If you upgrade past SDK 50 in the future, re-evaluate.

---

## What's verified vs deferred

This codebase has been governance-audited (PR #2) and TPM-driven (PR #3) and built up to the full UI shell here. **257+ unit tests across 17 suites pass deterministically.**

What this repository CAN'T do from a headless cloud VM:
- Run on an Android emulator or iOS simulator (no display, no Android tooling)
- Perform a clean-device manual walkthrough
- Inspect the actual Keychain / Keystore contents on a device
- Observe real network traffic against Gmail / OpenAI / etc.

These steps are the responsibility of the developer running `npx expo start` on a local machine. Every code-level invariant they would check is also pinned by a unit test in `__tests__/unit/`.

---

## License

TBD. Until set, treat as all rights reserved.
