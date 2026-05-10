# PRD — Build Execution Cycle Two

**Owner:** TPM
**References:** [`PRD_CYCLE_1.md`](./PRD_CYCLE_1.md), [`GAP_REGISTER_2.md`](./GAP_REGISTER_2.md)

---

## Executive summary

Cycle One delivered the entire service / store / agent / tools backbone (8 net new modules, 6 test suites added on top of the 4 existing ones, **187 tests / 12 suites green**, full strict-mode TypeScript clean, ESLint clean under `--max-warnings 0`). All 20 acceptance criteria for Cycle One are verified.

Cycle Two is the **UI-shell + integration cycle**. It closes 14 numbered residual gaps (`R-1`..`R-14`). After Cycle Two the application will launch on a real device, run the completeness journey end-to-end, and be ready for Final Verification — including the device-side checks that this run cannot perform from a headless cloud VM.

---

## §1 — Critical-path scope (must land)

### §1.1 — Bootstrap orchestration (R-11)

`src/services/bootstrap.ts`:
```ts
export const bootstrap = async (): Promise<Result<void, NexusError>>
```
Order (per directive):
1. `initializeDatabase()`
2. `preferencesStore.hydrateFromDb()`
3. `vaultStore.hydrate()`
4. `installApiClientDeps({ refresh: oauthService.refreshAccessToken, onDisconnected: vaultStore.markDisconnected })`
5. `installOAuthBackend(reactNativeAppAuth)`
6. `installContactsBackend(expoContacts)`
7. (if a default-country-code preference exists) `setDefaultCountryCode(value)`

### §1.2 — Root layout + onboarding gate (R-1, R-2, R-3)

`app/_layout.tsx`:
- Holds `expo-splash-screen` until `bootstrap()` resolves.
- On error → renders `<ErrorBoundaryFallback />`.
- After hydration: if `!hasAnyConnection(state) && !isOpenAiConfigured(state)` → `<Redirect href="/(tabs)/vault" />`.
- Otherwise renders `<Stack />` with the tabs and confirm modal.

`app/(tabs)/_layout.tsx`: three tabs — Chat (index), Vault, Memory.

`src/components/shared/ErrorBoundary.tsx`: class component implementing `componentDidCatch`, logs `error_boundary_caught` (only the screen name), renders a recovery UI with a "Reload" button that calls `Updates.reloadAsync()` (or just resets to `/`).

### §1.3 — Chat screen (R-2, R-4, R-6, R-7)

`app/(tabs)/index.tsx` renders:
- `<MessageBubble>` per history item
- `<ThinkingIndicator>` while `agentStatus === 'processing_intent'`
- `<ToolExecutionBadge>` while `agentStatus === 'executing_tool'`
- `<ConfirmationCard>` inline when `agentStatus === 'requires_action'` and `pendingAction !== null`
- input bar (TextInput + Send button) — disabled unless `agentStatus === 'idle'`
- microphone button — Cycle Two but stubbed `disabled` if `useVoiceInput` not yet wired.

`src/hooks/useAgentLoop.ts`:
```ts
export const useAgentLoop = () => {
  const send = useCallback(async (msg: string) => {
    const deps: AgentDeps = buildDepsFromStores(/* chatStore, vaultStore, prefsStore */);
    await runAgentTurn(msg, deps);
  }, []);
  return { send };
};
```

`src/hooks/useConfirmation.ts`:
```ts
export const useConfirmation = () => {
  const pendingResolverRef = useRef<((d: {confirmed: boolean}) => void) | null>(null);
  const wait = () => new Promise<{ confirmed: boolean }>(resolve => {
    pendingResolverRef.current = resolve;
  });
  const confirm = () => pendingResolverRef.current?.({ confirmed: true });
  const cancel  = () => pendingResolverRef.current?.({ confirmed: false });
  return { wait, confirm, cancel };
};
```

The agent loop's `awaitConfirmation` is set to `wait` from this hook at boot.

### §1.4 — Vault screen (R-2, R-5)

`app/(tabs)/vault.tsx` renders:
- Top: header + "Connected services" copy
- For each `Provider` in `['openai', 'google', 'whatsapp']`: a `<ServiceCard>` showing status (connected with masked-tail / email / disconnected), tap to connect or disconnect-with-confirmation.
- For openai: when disconnected, the card expands to a masked TextInput; submit calls `openaiService.validateApiKey` then `tokenService.setToken('openai', 'apiKey', ...)` then `vaultStore.markConnected('openai')`.
- For google: when disconnected, card expands to capture clientId, then on connect calls `oauthService.connect('google', clientId)` and on success refreshes the vault snapshot.

### §1.5 — Memory screen (R-2)

`app/(tabs)/memory.tsx` renders the entries from `preferencesStore`. Add new (key, value, category dropdown), swipe-to-delete, edit-inline, "Clear all memories" with confirmation modal.

### §1.6 — Confirm modal (R-2)

`app/confirm.tsx` is a modal route used as a fallback when the inline ConfirmationCard cannot be rendered (e.g. focus is on a different screen). For Cycle Two the inline card is preferred; the modal is reserved for cross-screen confirmations and may be authored in Cycle Three.

### §1.7 — Concurrency gate (R-14)

Add `chatStore.isAgentBusy` selector returning `agentStatus !== 'idle'`. Send button is disabled while busy. The `useAgentLoop.send` rejects calls when busy with a no-op rather than queueing — keeps invariants simple.

---

## §2 — Important scope (Cycle Two; non-blocking for completeness journey)

### §2.1 — Voice input (R-8)

`src/hooks/useVoiceInput.ts`, `src/tools/whisper.ts`, registry entry. The Whisper backing service already exists (`openaiService.transcribeAudio`). Mic permission, recording, transcript-injection-into-input-bar with 500ms debounce.

### §2.2 — WhatsApp (R-9)

`src/services/whatsappService.ts`, `src/tools/whatsapp.ts`. WhatsApp Business API requires a configured number; the Vault screen for WhatsApp will capture the API key.

### §2.3 — Location (R-10)

`src/tools/location.ts`. Uses expo-location with permission-denied → `PERMISSION_DENIED` semantic.

### §2.4 — Detox E2E (R-12)

`__tests__/e2e/chatFlow.test.ts` covering the canonical journey. Requires Android emulator or iOS simulator — not authorable from this cloud VM.

---

## §3 — Regression protection contract

The following Cycle One tests **MUST** continue to pass through every commit of Cycle Two. Any failure is a regression and blocks the cycle until fixed.

| Suite | Tests | Why |
| --- | --- | --- |
| `tokenService.test.ts` | 30 | LAW 1, LAW 5 invariants |
| `security.boundary.test.ts` | 11 | LAW 5 atomicity, LAW 2 hygiene |
| `logger.test.ts` | 15 | LAW 2 invariant |
| `database.test.ts` | 8 | DB bootstrap |
| `apiClient.test.ts` | 14 | 401 refresh / dedupe / error mapping |
| `oauthService.test.ts` | 14 | PKCE flow, atomic rotation |
| `openaiService.test.ts` | 11 | API key validation, wire shape |
| `googleService.test.ts` | 12 | Gmail / Calendar wire shape |
| `preferencesRepo.test.ts` | 10 | DB CRUD |
| `stores.test.ts` | 15 | FSM transitions, hydration |
| `tools.test.ts` | 22 | tool param validation, contacts permission |
| `agent.test.ts` | 21 | iteration cap, confirmation gate, error semantic |

**Total regression-protected: 187 tests.**

In addition, every Cycle Two commit must:
1. `npx tsc --noEmit` exit 0
2. `npx eslint src __tests__ --ext .ts,.tsx --max-warnings 0` exit 0
3. `npx jest` exit 0 with **zero new failures and no skipped tests**

---

## §4 — Acceptance criteria for Cycle Two

These will be enumerated when Cycle Two begins; the structure mirrors PRD Cycle One §13. The Final Verification Report must mark each as Verified, Deferred-with-reason, or Failed. No criterion may be left in an unmarked state.
