# Project Nexus — Situation Assessment

**TPM:** Technical Product Manager
**Date:** 2026-05-10
**Codebase HEAD at assessment time:** `cursor/governance-audit-358a` (PR #2 stacked on PR #1)

---

## §1. What exists and is working

The four foundational subsystems below are governance-certified (see [`GOVERNANCE.md`](../GOVERNANCE.md)) and will be relied on as load-bearing for everything in Build Cycle One. They are functional, tested, and will work for a real user the moment a UI shell consumes them.

| Subsystem | Path | Status |
| --- | --- | --- |
| Strict-typed shared contracts | `src/types/auth.ts` | Complete: `Result<T, E>`, `NexusError`, `Provider`, `TokenType`, `OAuthToken`, `ServiceConnection`, `VaultSnapshot`, `NexusErrorCode`. |
| Privacy-safe logger | `src/utils/logger.ts` | Complete: allowlisted-field structured logger with PII regex defense; pinned by 15 unit tests. |
| Secure token service | `src/services/tokenService.ts` | Complete: SecureStore I/O, atomic OAuth bundle rotation with rollback, vault snapshots; pinned by ~30 unit tests + 11 boundary scenarios. |
| SQLite bootstrap | `src/db/database.ts`, `src/db/schema.sql` | Complete: idempotent init, forward-only migrations, programmer-error guard; pinned by 8 unit tests. |
| Build / test rig | `tsconfig.json`, `tsconfig.test.json`, `jest.config.js`, `.eslintrc.cjs` | Complete: strict-mode TS, ts-jest unit runner, eslint `--max-warnings 0`. |

**68 / 68 tests passing across 4 suites at the start of this cycle.**

## §2. What exists but is broken

**Nothing.** The audited subsystems passed Governance Run #1 cleanly — no defects in the deferred state. Every defect found in that run was resolved before this cycle began.

## §3. What does not exist at all

This is the gap surface. Everything below is required by the original PRD / engineering directive for the **core completeness journey** (open app → Vault → enter OpenAI key → connect Google → return to chat → "show last 5 emails" → response with confirmation gate for sends) to function:

### §3.1 — Service layer (HTTP, OAuth, external APIs)

| Missing file | What it owns | Critical path? |
| --- | --- | --- |
| `src/services/apiClient.ts` | Axios instance + interceptors: bearer-token injection, 401 → refresh-and-retry, 429/5xx → typed `NexusError`. | **Yes — every Gmail/Calendar/WhatsApp/OpenAI request flows through it.** |
| `src/services/oauthService.ts` | `react-native-app-auth` PKCE config builder, `connect(provider)`, `disconnect(provider)`, `refreshAccessToken(provider)`. | **Yes — without it the user cannot connect Google.** |
| `src/services/openaiService.ts` | `chatCompletion(messages, tools)`, `transcribeAudio(uri)` against api.openai.com using the user's stored API key. | **Yes — every agent turn calls it.** |
| `src/services/googleService.ts` | `listMessages`, `getMessage`, `sendMessage` (Gmail), `createEvent`, `getNextEvent` (Calendar). | **Yes — the canonical demo journey.** |
| `src/services/whatsappService.ts` | `sendTextMessage` against WhatsApp Business API. | No (deferred — most beta users won't have a WABA configured). |

### §3.2 — Database repository

| Missing file | What it owns | Critical path? |
| --- | --- | --- |
| `src/db/preferencesRepo.ts` | CRUD for `user_preferences`; loaded at boot, injected into every system prompt. | **Yes — system prompt is dynamic per user memory.** |

### §3.3 — Agent core

| Missing file | What it owns | Critical path? |
| --- | --- | --- |
| `src/types/agent.ts` | `Message`, `ToolCall`, `ToolResult`, `AgentStatus`, `PendingAction`. | **Yes — typed boundary between LLM, executor, and stores.** |
| `src/types/tools.ts` | Per-tool parameter and result types. | **Yes — discriminated dispatch in toolExecutor.** |
| `src/agent/toolRegistry.ts` | Single source of truth for tool definitions + `isDestructive` flags. | **Yes — drives confirmation gate.** |
| `src/agent/toolExecutor.ts` | Dispatches a `ToolCall` to the right executor; wraps every result in `Result<T, NexusError>`. | **Yes — the LLM's hand on the world.** |
| `src/agent/systemPrompt.ts` | Builds the dynamic system prompt from preferences + connected services + clock. | **Yes — system prompt is rebuilt every turn.** |
| `src/agent/agentLoop.ts` | Recursive tool-calling loop with iteration cap (10), confirmation pause/resume, semantic error recovery. | **Yes — the heart of Nexus.** |

### §3.4 — Tools

| Missing file | What it owns | Critical path? |
| --- | --- | --- |
| `src/tools/gmail.ts` | `gmail_read_recent` (read-only), `gmail_send_email` (destructive). | **Yes.** |
| `src/tools/googleCalendar.ts` | `google_calendar_create_event` (destructive), `google_calendar_get_next` (read-only). | **Yes.** |
| `src/tools/contacts.ts` | `system_contacts_search` (read-only). | **Yes — name → phone resolution before any send.** |
| `src/tools/whatsapp.ts` | `whatsapp_send_message` (destructive). | No (paired with deferred whatsapp service). |
| `src/tools/location.ts` | `system_get_location`. | No (deferred — secondary feature). |
| `src/tools/whisper.ts` | `voice_transcribe_audio`. | No (deferred — voice path is staged). |

### §3.5 — State stores

| Missing file | What it owns | Critical path? |
| --- | --- | --- |
| `src/store/chatStore.ts` | `messages`, `agentStatus`, `currentToolName`, `pendingAction`, action methods. | **Yes — drives all chat UI rendering.** |
| `src/store/vaultStore.ts` | Connected-services snapshot, sync from tokenService at boot, mutate on connect/disconnect. | **Yes — drives Vault screen + onboarding gate.** |
| `src/store/preferencesStore.ts` | In-memory mirror of `user_preferences` rows. | **Yes — read by systemPrompt every turn.** |

### §3.6 — Hooks

| Missing file | What it owns | Critical path? |
| --- | --- | --- |
| `src/hooks/useAgentLoop.ts` | Trigger agent from a component, subscribe to status. | **Yes.** |
| `src/hooks/useConfirmation.ts` | Promise-based confirm/cancel that the agent loop awaits. | **Yes — confirmation gate.** |
| `src/hooks/useVoiceInput.ts` | Mic permission, Audio.Recording, Whisper post. | No (deferred). |

### §3.7 — Components

All component files under `src/components/{chat,vault,shared}/` are missing. Critical: `ConfirmationCard`, `ServiceCard`, `MessageBubble`, `ThinkingIndicator`, `ToolExecutionBadge`, `ErrorBoundary`. UI-only items (`LoadingSpinner`, `ConnectButton`) are also missing but secondary.

### §3.8 — Screens

`app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` (chat), `app/(tabs)/vault.tsx`, `app/(tabs)/memory.tsx`, `app/confirm.tsx` are all missing. Without them the app cannot launch.

---

## §4. Honest scope statement for Build Cycle One

The completeness standard requires a real device walkthrough. This run is on a headless Linux cloud VM with no Android / iOS emulator and no display. Any phase that requires a running device (Detox E2E, manual walkthrough, Keychain inspector, network inspector) cannot be performed here and will be reported as **Deferred** in the Final Verification Report, **never** as "passing".

What this run **can** verify:
- TypeScript strict-mode correctness (`tsc --noEmit`)
- ESLint cleanliness under `--max-warnings 0`
- Unit tests for every service, tool, store action, agent-loop transition, and tool executor
- Internal contract integrity (every consumer types against the producer's exported shape)
- Privacy-logger compliance for any new event sites
- The atomic-rotation invariant of `setOAuthBundle` is unaffected by new write sites

Build Cycle One scope (in dependency order):

1. Contracts: `types/agent.ts`, `types/tools.ts`
2. HTTP / OAuth: `apiClient`, `oauthService`
3. External clients: `openaiService`, `googleService`
4. DB repo: `preferencesRepo`
5. Stores: `vaultStore`, `chatStore`, `preferencesStore`
6. Agent core: `toolRegistry`, `toolExecutor`, `systemPrompt`, `agentLoop`
7. Tools: `gmail`, `googleCalendar`, `contacts`
8. UI shell (capacity-permitting in this turn; otherwise Cycle Two): hooks, components, screens
9. Deferred: `whatsappService` + `tools/whatsapp`, `tools/location`, `tools/whisper` + `hooks/useVoiceInput`, Detox E2E suite, on-device verification.
