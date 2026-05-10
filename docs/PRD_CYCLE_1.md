# PRD — Build Execution Cycle One

**Owner:** TPM
**References:** [`SITUATION_ASSESSMENT.md`](./SITUATION_ASSESSMENT.md), [`GAP_REGISTER_1.md`](./GAP_REGISTER_1.md)

---

## Executive summary

28 gaps were identified across the seven core user journeys. **22** of those gaps are on the critical path of the completeness journey (open → Vault → connect → chat → Gmail read with confirmation gate for sends). **6** are explicitly Deferred to Cycle Two — voice input (F-1..F-5) and the WhatsApp send pair (E-6).

After this PRD is implemented, the application's expected state is: every service contract, every store, the entire agent core, and the Gmail / Calendar / contacts tool surface will be type-safe, unit-tested, and lint-clean. The UI shell (hooks, components, screens) will be the focus of the rest of this turn if capacity allows; otherwise it ships in Cycle Two with regression protection of every Cycle One contract.

---

## §1 — Initialization system

**Closes:** A-1, A-2, A-3, A-4, X-6.

- `app/_layout.tsx` (created): root layout. In `useEffect` runs in order: `initializeDatabase()`, `preferencesStore.hydrateFromDb()`, `vaultStore.hydrate()`. Holds the splash visible via `expo-splash-screen` until all three resolve. On error → renders `ErrorBoundary` fallback. After hydration, if `vaultStore.hasAnyConnection() === false` AND `vaultStore.openAiConfigured === false`, it does `<Redirect href="/vault" />`. Otherwise it renders `<Slot />`.
- `app/(tabs)/_layout.tsx` (created): tabs config — Chat (`index`), Vault, Memory.
- `src/components/shared/ErrorBoundary.tsx` (created): React class component, `componentDidCatch` calls `logError('error_boundary_caught', { screen })` (only the screen name reaches the logger).

## §2 — Token management system

**Status:** complete from earlier work. **Regression contract:** every test in `__tests__/unit/tokenService.test.ts` and `__tests__/unit/security.boundary.test.ts` MUST remain passing through Cycle One. New writers may not bypass `setOAuthBundle`'s atomicity.

## §3 — OAuth system

**Closes:** C-1, C-2, C-3, C-4, C-5.

`src/services/oauthService.ts`:

```ts
export const buildGoogleConfig = (clientId: string): GoogleAuthConfig
export const connect = (provider: 'google', clientId: string)
  => Promise<Result<{ email: string | null }, NexusError>>
export const disconnect = (provider: Provider)
  => Promise<Result<void, NexusError>>
export const refreshAccessToken = (provider: 'google')
  => Promise<Result<string, NexusError>>
export const decodeIdToken = (idToken: string): { email: string | null }
```

- Redirect URL pinned to `com.nexus.app:/oauth2redirect/google`.
- Scopes: `openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar`.
- `additionalParameters: { access_type: 'offline', prompt: 'consent' }` to guarantee a refresh token on first consent.
- `connect()` calls `authorize()` then `tokenService.setOAuthBundle('google', { accessToken, refreshToken, accessTokenExpirationDate, userEmail, clientId })`. Atomic per existing rollback contract.
- `refreshAccessToken()` calls `react-native-app-auth.refresh({ refreshToken, clientId })` and persists the new access token + expiry. On refresh failure, returns `NexusError('SESSION_EXPIRED', …, { isRetryable: false })`.
- `decodeIdToken()` does pure base64 JSON parsing of the payload section. Returns `{ email: null }` on any parse failure (never throws). Verifying the JWT signature locally is intentionally NOT performed — the token was just produced by the IdP via authorize() so signature verification adds no real safety on-device.

`src/services/whatsappService.ts` — Deferred to Cycle Two.

## §4 — HTTP / apiClient

**Closes:** D-1, D-2.

`src/services/apiClient.ts`:

```ts
type NexusRequestConfig = AxiosRequestConfig & {
  nexusProvider?: 'google' | 'openai';
  _retry?: boolean;
};

export const apiClient: AxiosInstance        // shared instance
export class SessionExpiredError extends NexusError
```

- Request interceptor reads `nexusProvider`. If `'google'`, attaches `Authorization: Bearer <accessToken>` from `tokenService.getToken('google', 'accessToken')`. If `'openai'`, attaches `Authorization: Bearer <apiKey>` from `tokenService.getToken('openai', 'apiKey')`. Otherwise no header injection.
- Response error interceptor:
  1. If `error.response?.status !== 401` OR `nexusProvider !== 'google'` OR `_retry === true` → reject as a typed `NexusError` mapped from status (`429 → RATE_LIMITED` (new code) with `Retry-After` parsed; `5xx → NETWORK_ERROR` retryable; other 4xx → `PROVIDER_ERROR` non-retryable).
  2. Else mark `_retry = true`, `await getOrCreateRefresh('google')`, replay the original request with the new token.
- `getOrCreateRefresh(provider)` uses an in-module `Map<Provider, Promise<string>>` so concurrent 401s share a single refresh round-trip (closes D-2). On refresh success, the entry is cleared from the Map. On refresh failure, vaultStore is dispatched `markDisconnected(provider)` and a `SessionExpiredError` is thrown.

NexusErrorCode is widened to add `'RATE_LIMITED'` since the directive explicitly mentions it but the code did not previously include it.

## §5 — External service clients

**Closes:** D-3, D-7, G-1, G-3.

`src/services/openaiService.ts`:

```ts
export const validateApiKey = (value: string): Result<string, NexusError>
export const chatCompletion = (req: ChatCompletionRequest)
  => Promise<Result<ChatCompletionResponse, NexusError>>
export const transcribeAudio = (audioUri: string)
  => Promise<Result<{ text: string }, NexusError>>   // Cycle Two consumes this
```

- `validateApiKey`: rejects if not string, `length < 20`, doesn't start with `sk-`, or contains whitespace. Otherwise returns `ok(value)`.
- `chatCompletion`: `POST https://api.openai.com/v1/chat/completions` via `apiClient` with `nexusProvider: 'openai'`. Body: `{ model, messages, tools, tool_choice: 'auto', temperature: 0.2 }`.
- `transcribeAudio`: `POST /v1/audio/transcriptions` multipart form. Authored but the `useVoiceInput` hook that calls it is Cycle Two.

`src/services/googleService.ts`:

```ts
export const listGmailMessages = (params: { limit: number; query?: string })
  => Promise<Result<GmailMessageSummary[], NexusError>>
export const sendGmailMessage = (msg: { to: string; subject: string; body: string })
  => Promise<Result<{ id: string; threadId: string }, NexusError>>
export const createCalendarEvent = (event: CalendarEventInput)
  => Promise<Result<{ id: string; htmlLink: string }, NexusError>>
export const getNextCalendarEvent = ()
  => Promise<Result<CalendarEvent | null, NexusError>>
```

- All calls go through `apiClient` with `nexusProvider: 'google'`.
- `listGmailMessages` enforces `1 <= limit <= 10`; first call lists IDs, second fans-out to fetch metadata for each.
- `sendGmailMessage` builds an RFC 2822 string, base64url-encodes per Gmail's API contract, POSTs to `users/me/messages/send`.

## §6 — Agent core

**Closes:** D-4, D-5, D-6, X-1, X-2, X-3, X-4.

### `src/types/agent.ts`

```ts
export type AgentStatus = 'idle' | 'processing_intent' | 'executing_tool' | 'requires_action';
export interface ToolCall { id: string; name: string; arguments: Record<string, unknown>; }
export interface Message { role: 'system'|'user'|'assistant'|'tool'; content: string;
  tool_calls?: ToolCall[]; tool_call_id?: string; tool_name?: string; }
export interface PendingAction { toolName: string; toolCallId: string;
  parameters: Record<string, unknown>; displaySummary: string; }
export type ToolResult =
  | { ok: true; content: string }
  | { ok: false; reason: string };
```

### `src/agent/toolRegistry.ts`

A frozen array of `ToolDefinition` objects. Each has: `definition` (OpenAI tool schema), `isDestructive: boolean`, `executor` (a typed function reference), `summary: (params) => string` for the ConfirmationCard. Lookup helpers: `getTool(name)`, `getOpenAiToolDefinitions()`.

### `src/agent/toolExecutor.ts`

```ts
export const execute = (call: ToolCall): Promise<ToolResult>
```

Looks up the tool, validates args against a tiny per-tool TS guard, calls the executor, wraps in try/catch. Any thrown error → `{ ok: false, reason: error.message }`. NexusErrors → uses `error.code`-aware reason text.

### `src/agent/systemPrompt.ts`

```ts
export const build = (input: { now: Date; timezone: string;
  preferences: Record<string, string>; connectedProviders: Provider[] }): string
```

Pure function. No side effects. Returns the directive's "You are Nexus…" prompt with the four sections injected.

### `src/agent/agentLoop.ts`

```ts
export const runAgentTurn = (userMessage: string, deps: AgentDeps)
  => Promise<Result<void, NexusError>>
```

Where `AgentDeps` collects: `getHistory()`, `appendMessage()`, `setStatus()`, `setCurrentTool()`, `setPendingAction()`, `awaitConfirmation()`, `getPreferences()`, `getConnectedProviders()`, `chat()` (openai), `executeTool()`. Strict dependency injection so the loop is unit-testable end-to-end without React Native or network.

State machine implements the spec from the engineering directive. Iteration cap = 10. After 10 iterations append a synthetic assistant message `"I couldn't complete this in 10 steps. Please rephrase."` and return ok.

## §7 — Tools

**Closes:** D-4, E-1, E-2, E-3, G-2.

- `src/tools/gmail.ts`: `gmailReadRecent({ limit, query })`, `gmailSendEmail({ to, subject, body })`. Tool arguments validated with explicit guards (no `any`).
- `src/tools/googleCalendar.ts`: `googleCalendarCreateEvent`, `googleCalendarGetNext`.
- `src/tools/contacts.ts`: `systemContactsSearch({ query })`. Permission check → semantic error on denial.
- `src/utils/phoneNumber.ts`: `normalizeToE164(raw)`, `isValidE164(value)`.

## §8 — Stores

**Closes:** A-3, B-3, B-4, X-1, X-4.

- `src/store/vaultStore.ts`: state `{ snapshot: VaultSnapshot, hydrating: boolean }`; actions `hydrate()`, `markConnected(provider)`, `markDisconnected(provider)`, `hasAnyConnection()`, `openAiConfigured`. `hydrate()` calls `tokenService.getAllConnectedProviders`.
- `src/store/chatStore.ts`: per spec in directive, plus `appendMessage`, `getHistory`, `clearHistory`. Backed by `chat_history` table for persistence — `chatStore.persistAndAppend(message)` inserts into SQLite then updates Zustand state.
- `src/store/preferencesStore.ts`: state `{ entries: Record<string, string>, hydrating: boolean }`; actions `hydrateFromDb()`, `set(key, value, category)`, `delete(key)`, `clearAll()`. Wraps `preferencesRepo`.

## §9 — Database repository

**Closes:** A-2, X-4.

`src/db/preferencesRepo.ts`: `listAll()`, `upsert(key, value, category)`, `deleteByKey(key)`, `clear()`. Uses the shared `getDatabase()` handle. All operations return `Result<T, NexusError>`.

## §10 — Confirmation gate

**Closes:** E-4, E-5.

- `src/hooks/useConfirmation.ts`: exposes `awaitConfirmation()` returning a Promise resolved by `confirm()` / `cancel()` actions on the chatStore. The promise is created when agentLoop calls `setPendingAction`, resolved by user UI interaction.
- `src/components/chat/ConfirmationCard.tsx`: Cycle One authors the contract; UI styling can iterate.

## §11 — Logger

**Codes added:** `RATE_LIMITED`. New event names introduced are subject to LAW 2 hygiene. New tests in Cycle One MUST verify no token, key, or message body reaches the console.

---

## §12 — Integration checklist (external APIs)

| Service | Endpoint | Auth header | Success shape | Error shapes (mapped) |
| --- | --- | --- | --- | --- |
| OpenAI chat | `POST https://api.openai.com/v1/chat/completions` | `Authorization: Bearer sk-…` | `{ choices:[{ message:{ role, content?, tool_calls? }, finish_reason }] }` | 401→`SESSION_EXPIRED`; 429 (Retry-After)→`RATE_LIMITED` retryable; 5xx→`NETWORK_ERROR` retryable; other 4xx→`PROVIDER_ERROR` non-retryable. |
| OpenAI Whisper | `POST /v1/audio/transcriptions` (multipart) | `Bearer sk-…` | `{ text: string }` | as above. |
| Gmail list | `GET /gmail/v1/users/me/messages?maxResults=&q=` | `Bearer <google access token>` | `{ messages:[{id, threadId}] }` | 401→trigger refresh-and-retry once; 429→`RATE_LIMITED`; else as above. |
| Gmail metadata | `GET /messages/{id}?format=metadata&metadataHeaders=From,Subject,Date` | same | `{ id, snippet, payload:{ headers:[{name,value}] } }` | as above. |
| Gmail send | `POST /messages/send` body `{ raw: <base64url RFC2822> }` | same | `{ id, threadId }` | as above. |
| Calendar create | `POST /calendar/v3/calendars/primary/events` | same | `{ id, htmlLink }` | as above. |
| Calendar list-next | `GET /calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=<now>&maxResults=1` | same | `{ items: CalendarEvent[] }` | as above. |
| Google token refresh | `POST https://oauth2.googleapis.com/token` (handled inside `react-native-app-auth.refresh`) | per RFC | `{ access_token, expires_in }` | refresh failure → `SESSION_EXPIRED`. |

---

## §13 — Acceptance criteria

Every criterion below MUST be either Verified (unit-tested or static-typed) or explicitly Deferred (with reason) at the end of Cycle One.

1. `apiClient` injects the correct provider's bearer token on the request interceptor — **Verifiable by unit test**.
2. A 401 response from `nexusProvider: 'google'` triggers exactly one refresh attempt, replays the original request, and shares the refresh promise across concurrent failures — **Verifiable by unit test**.
3. A 429 response surfaces a `NexusError` with `code: 'RATE_LIMITED'`, `isRetryable: true`, and the `Retry-After` value parsed onto the error if present — **Verifiable by unit test**.
4. A refresh failure marks the provider disconnected in vaultStore and throws `SessionExpiredError` — **Verifiable by unit test**.
5. `oauthService.connect('google', clientId)` writes exactly the four token fields and the user email to SecureStore via `setOAuthBundle` (atomic) — **Verifiable by unit test**.
6. `oauthService.disconnect('google')` removes all five google keys idempotently — **Verifiable by unit test**.
7. `openaiService.validateApiKey` accepts well-formed `sk-…` strings and rejects empty / non-string / wrong-prefix / whitespace-containing values — **Verifiable by unit test**.
8. `googleService.listGmailMessages({ limit })` clamps `limit` to `[1, 10]` — **Verifiable by unit test**.
9. `googleService.sendGmailMessage` produces a valid base64url-encoded RFC 2822 string — **Verifiable by unit test**.
10. `googleService.createCalendarEvent` posts the expected body shape — **Verifiable by unit test**.
11. `agentLoop.runAgentTurn`: a single read-only tool call cycle (LLM tool_calls → executor → tool result → LLM final → assistant message appended) completes the agent state machine `idle → processing_intent → executing_tool → idle` — **Verifiable by unit test with mocked `chat()` and `executeTool()`**.
12. `agentLoop.runAgentTurn`: a destructive tool call pauses on `setPendingAction`, waits for `awaitConfirmation`, executes on confirm, returns cancellation message on cancel — **Verifiable by unit test**.
13. `agentLoop.runAgentTurn`: ten consecutive tool-call iterations terminate with the synthetic timeout message — **Verifiable by unit test**.
14. `toolExecutor.execute`: any exception thrown by an executor becomes `{ ok: false, reason: <safe message> }` — **Verifiable by unit test**.
15. `systemPrompt.build`: output is deterministic for fixed inputs and contains every preference key — **Verifiable by unit test**.
16. `chatStore.persistAndAppend(msg)` writes to SQLite and to in-memory state in one transaction — **Verifiable by unit test against the in-memory db harness**.
17. `vaultStore.hydrate()` populates from `tokenService.getAllConnectedProviders()` — **Verifiable by unit test**.
18. `preferencesRepo` round-trips arbitrary keys/values with category — **Verifiable by unit test**.
19. `phoneNumber.normalizeToE164` handles common Indian, US, UK formats; rejects non-numeric — **Verifiable by unit test**.
20. **Logger LAW 2 invariant** survives every new event site introduced in Cycle One — **Verifiable by unit test (extension of existing `logger.test.ts` patterns)**.

Acceptance criteria 21+ (UI shell, Detox, manual walkthrough, on-device storage inspector) — **Deferred to Cycle Two and Final Verification**.
