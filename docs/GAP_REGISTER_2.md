# Gap Register — Phase Two

This phase is forensic. Phase One was simulation against a blank slate; Phase Two compares the Cycle One implementation against the 20 acceptance criteria and looks for the three categories the TPM prompt names — **specification drift**, **integration gaps**, and **emergent edge cases**.

Two of those categories require a running device (integration gaps surface as the real Gmail / Calendar / OpenAI APIs return shapes that differ from this PRD's assumptions; emergent edge cases require concurrency over real network). Those are explicitly Deferred. Phase Two below is rigorous about everything that **can** be examined without a running device or real API.

---

## Acceptance-criterion verification matrix

| AC | Spec | Verification | Status |
| --- | --- | --- | --- |
| 1 | apiClient injects correct provider bearer | `apiClient.test.ts` § "request interceptor — token injection" (4 tests) | **Verified** |
| 2 | 401 → exactly one refresh, replays original, dedupes concurrent | `apiClient.test.ts` § "response interceptor — 401 refresh path" (5 tests including 3 concurrent 401s → 1 refresh) | **Verified** |
| 3 | 429 → RATE_LIMITED retryable + Retry-After parsed | `apiClient.test.ts` § "error mapping" | **Verified** |
| 4 | Refresh failure → markDisconnected + SessionExpiredError | `apiClient.test.ts` "on refresh failure: marks provider disconnected …" | **Verified** |
| 5 | `connect('google', clientId)` writes 5 fields atomically via setOAuthBundle | `oauthService.test.ts` "persists every field … atomically", plus rollback test | **Verified** |
| 6 | `disconnect('google')` removes all 5 keys idempotently | `oauthService.test.ts` "removes every stored credential" | **Verified** |
| 7 | `validateApiKey` accepts well-formed `sk-…`, rejects bad shapes | `openaiService.test.ts` § "validateApiKey" (6 tests) | **Verified** |
| 8 | `listGmailMessages` clamps `limit` to `[1, 10]` | `googleService.test.ts` "clamps limit to [1, 10]" + "clamps upward to 1" | **Verified** |
| 9 | `sendGmailMessage` produces base64url RFC 2822 | `googleService.test.ts` "buildGmailRawPayload produces a base64url string with no padding" + "POSTs the canonical {raw} body shape" | **Verified** |
| 10 | `createCalendarEvent` posts expected body shape | `googleService.test.ts` "POSTs the canonical body shape with summary, start, end" | **Verified** |
| 11 | Single-tool turn drives the FSM `idle → processing_intent → executing_tool → idle` | `agent.test.ts` "a single non-destructive tool call: dispatch -> tool result -> stop" | **Verified** |
| 12 | Destructive tool pauses on pendingAction; cancel returns "User cancelled" | `agent.test.ts` "pauses on requires_action and resumes" + "cancelled returns the cancellation message and never executes" | **Verified** |
| 13 | 10 consecutive tool calls terminate with synthetic message | `agent.test.ts` "hits the iteration cap when the model never returns a stop" | **Verified** |
| 14 | Any executor exception → `{ ok: false, reason }` | `agent.test.ts` "returns ok=false reason on invalid input parameters" + the `try/catch` in `toolExecutor` itself; backed by `tool_exception` log path | **Verified** |
| 15 | `systemPrompt.build` deterministic for fixed inputs | `agent.test.ts` "is deterministic for fixed inputs" | **Verified** |
| 16 | `chatStore.appendMessage` keeps history in lockstep | `stores.test.ts` "appendMessage and appendMessages preserve order" | **Verified** |
| 17 | `vaultStore.hydrate()` populates from `tokenService.getAllConnectedProviders` | `stores.test.ts` "hydrate populates the snapshot from tokenService" | **Verified** |
| 18 | `preferencesRepo` round-trips arbitrary key/value | `preferencesRepo.test.ts` "inserts a new preference …" + "updates an existing preference value …" | **Verified** |
| 19 | `phoneNumber.normalizeToE164` handles common formats | `tools.test.ts` § "phoneNumber" (7 tests) | **Verified** |
| 20 | Logger LAW 2 invariant holds across every new event site | `logger.test.ts` (15 tests) + `tokenService.test.ts` "logging hygiene" + `security.boundary.test.ts` LAW 2 path | **Verified** |

**20 / 20 acceptance criteria from PRD Cycle One verified by unit tests.**

---

## Specification drift

### SD-1 (resolved without code change)

**Drift:** The directive describes the agent state machine as `idle → processing_intent → executing_tool → requires_action`. Cycle One implements an additional, narrower legal transition `executing_tool → processing_intent` (re-entry into LLM call after tool result append). This is required for multi-step tool chains to work — without it, a chain of two tool calls cannot return to the LLM.

**Resolution:** ratify into the spec. The transition table in `chatStore.isAllowedTransition` already encodes this; Cycle Two PRD will document it in `SITUATION_ASSESSMENT.md` if needed.

### SD-2 (resolved without code change)

**Drift:** Directive says "max 10 recursive iterations". Implementation enforces ≤ 10 via a counted for-loop rather than recursive call depth. Functionally identical; trivially observable as the synthetic message after exactly 10 dispatches in `agent.test.ts`.

**Resolution:** ratify; the for-loop form avoids potential stack-depth concerns on long tool chains.

### SD-3 (drift exists; Cycle Two will close)

**Drift:** Directive lists `voice_transcribe_audio` as a registered tool. Cycle One does not include it (no useVoiceInput hook authored). The OpenAI service has `transcribeAudio` already authored, but the tool registry does not advertise a `voice_transcribe_audio` schema to the LLM.

**Resolution:** intentional — voice was deferred. Documented in PRD Cycle Two §1.

### SD-4 (drift exists; Cycle Two will close)

**Drift:** Directive lists `whatsapp_send_message` as a registered tool. Cycle One excludes it.

**Resolution:** intentional — WhatsApp deferred. Documented in PRD Cycle Two §2.

---

## Integration gaps (cannot be observed without a running device)

| ID | Surface | Risk |
| --- | --- | --- |
| IG-1 | Gmail metadata response shape (`payload.headers`, `internalDate`) | The implementation matches the documented Gmail v1 shape, but the actual API may return additional or differently-cased headers. Cycle One's tests use the documented shape; Cycle Two will run a live integration test once a real grant is available. |
| IG-2 | Calendar `start.dateTime` vs `start.date` for all-day events | Implementation handles both via fallback chain. Real-world all-day events are not covered by current unit tests. |
| IG-3 | Whisper multipart shape on real RN runtime | `transcribeAudio` builds a `FormData` with the React Native fetch's `{uri, name, type}` blob shape. Verified shape only against the axios stub adapter; real RN will exercise the actual fetch underneath. |
| IG-4 | OpenAI 401 with `Authorization: Bearer ` for openai is not refreshable | apiClient correctly does NOT attempt to refresh openai tokens (no refresh-token flow exists). The user must reconnect via Vault. UI to surface this is out of Cycle One scope. |
| IG-5 | react-native-app-auth's exact `accessTokenExpirationDate` format on Android vs iOS | Implementation accepts any `Date.parse`-able string. The actual library is documented to return ISO 8601, but real-device runs may differ; covered by Phase Two of Cycle Two on a real device. |

All five integration gaps are low-risk because the implementation tolerates the documented shape and any deviation will produce a typed `NexusError` at the apiClient boundary rather than crashing the app.

---

## Emergent edge cases (cannot be observed without device-level concurrency)

| ID | Scenario | Mitigation in Cycle One |
| --- | --- | --- |
| EE-1 | Two near-simultaneous user messages trigger two concurrent agent loops | Not yet mitigated. Cycle Two will add a `chatStore.isAgentBusy` gate and queue/reject the second invocation. |
| EE-2 | A 401 burst across multiple Google services in the same turn | Already mitigated: apiClient `inflightRefresh` Map dedupes concurrent refreshes per provider (PRD §4 D-2; verified by `apiClient.test.ts` "shares one refresh across concurrent 401s"). |
| EE-3 | Token rotation race during a destructive confirmation pause | Confirmation pause holds the loop; if the access token expires while waiting, the next tool call's request interceptor will fetch the now-rotated token from SecureStore (LAW 1 — single source of truth). No additional code needed. |
| EE-4 | Preferences updated during an agent turn | `systemPrompt.build` is called at iteration 1 only; preferences set after that are NOT reflected until the next turn. Documented behavior; Cycle Two PRD will state this explicitly. |

---

## Residual gap register (Cycle Two scope)

Numbered for direct reference from PRD Cycle Two.

- **R-1** — `app/_layout.tsx` does not exist; the app cannot launch. (Originally A-1.)
- **R-2** — `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/vault.tsx`, `app/(tabs)/memory.tsx`, `app/confirm.tsx` do not exist.
- **R-3** — `src/components/shared/ErrorBoundary.tsx` does not exist; the directive requires every screen to be wrapped in one.
- **R-4** — `src/components/chat/{MessageBubble,ThinkingIndicator,ToolExecutionBadge,ConfirmationCard}.tsx` do not exist.
- **R-5** — `src/components/vault/{ServiceCard,ConnectButton}.tsx` do not exist.
- **R-6** — `src/hooks/useAgentLoop.ts` does not exist; the agent loop has no React adapter.
- **R-7** — `src/hooks/useConfirmation.ts` does not exist; the agent loop's `awaitConfirmation` injection point has no React-side implementation.
- **R-8** — Voice input subsystem deferred (R-8.a `tools/whisper.ts`, R-8.b `hooks/useVoiceInput.ts`, R-8.c registry entry).
- **R-9** — WhatsApp subsystem deferred (R-9.a `services/whatsappService.ts`, R-9.b `tools/whatsapp.ts`, R-9.c registry entry).
- **R-10** — Location tool deferred (`tools/location.ts` + registry entry).
- **R-11** — `src/services/bootstrap.ts` (or boot logic in `_layout`) wiring `installApiClientDeps`, `installOAuthBackend`, `installContactsBackend`, store hydration, redirect-on-no-config — does not exist.
- **R-12** — Detox E2E suite does not exist.
- **R-13** — On-device verification (Keychain inspector, network inspector, manual walkthrough) cannot be performed from this VM and is deferred to a future run on a developer's local machine or an emulator-equipped runner.
- **R-14** (cross-cutting) — Concurrency gate for parallel agent invocations (EE-1).

**Severity classification:**
- R-1, R-2, R-3 — **critical** for the completeness journey. Without them the app cannot launch.
- R-4, R-5, R-6, R-7, R-11 — **critical** for the completeness journey. Without them the user can't interact.
- R-8, R-9, R-10 — **important** but secondary. The completeness journey ("show last 5 emails") works without them.
- R-12 — **structural**. E2E coverage; supplements but does not replace the unit suite.
- R-13 — **structural / process**. Required for final certification.
- R-14 — **quality**. Real-world edge case.

**No critical defects were introduced by Cycle One in any subsystem that DID land.** All 20 PRD acceptance criteria are verified.
