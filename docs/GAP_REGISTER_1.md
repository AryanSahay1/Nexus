# Gap Register — Phase One

The seven user journeys from the TPM prompt are simulated below. Every place where the chain of execution would break against the current codebase yields a numbered gap statement.

Format:
- **Journey** — which user journey it affects
- **Execution point** — where in the chain it breaks
- **Technical cause** — why
- **Required change** — what closes it (drives the PRD)

---

## Journey A: First Launch

**A-1** Journey=A; Point=app boot; Cause=`app/_layout.tsx` does not exist; Change=create root layout that initializes DB, hydrates vault store, hydrates preferences store, mounts ErrorBoundary, renders typed router.

**A-2** Journey=A; Point=DB init; Cause=`initializeDatabase()` is implemented but never called from any application entry point; Change=call from root layout's `useEffect` and gate UI on its completion.

**A-3** Journey=A; Point=onboarding gate; Cause=no logic decides whether to land the user on Vault vs. Chat at startup; Change=in root layout, after vault hydration, redirect to `/vault` if `vaultStore.hasAnyConnection() === false`, else to `/`.

**A-4** Journey=A; Point=splash flash; Cause=no branded splash; Change=use `expo-splash-screen` to keep splash visible until init resolves.

## Journey B: API key entry

**B-1** Journey=B; Point=Vault screen; Cause=`app/(tabs)/vault.tsx` does not exist; Change=create Vault screen that renders OpenAI input + per-provider service cards.

**B-2** Journey=B; Point=key validation; Cause=no validation enforces `sk-` prefix and minimum length; Change=`openaiService.validateApiKey(value): Result<string, NexusError>` returning `INVALID_INPUT` on shape mismatch, called by Vault submit handler.

**B-3** Journey=B; Point=persistence; Cause=tokenService can persist, but no caller wires it to the UI; Change=Vault submit handler calls `setToken('openai', 'apiKey', validated)` and on success refreshes vaultStore.

**B-4** Journey=B; Point=visual confirmation; Cause=Vault has no display logic for masked-tail; Change=`ServiceCard` shows "•••• \<last4\>" when openai status is `connected`.

## Journey C: Google OAuth

**C-1** Journey=C; Point=Connect Google button; Cause=`oauthService.connect('google', clientId)` does not exist; Change=author oauthService that builds `react-native-app-auth` config, runs `authorize()`, parses ID token for email, persists via `tokenService.setOAuthBundle`.

**C-2** Journey=C; Point=redirect URL registration; Cause=`app.json` lacks any OAuth-deep-link scheme; Change=add `scheme: "nexus"` (already present) and `redirectUrl: "com.nexus.app:/oauth2redirect/google"` documented in oauthService.

**C-3** Journey=C; Point=client ID source; Cause=client ID is user-supplied per directive but no UI lets the user enter it; Change=Vault screen `ServiceCard` for Google opens a setup sheet that captures `clientId` (stored as `nexus_google_clientId`) before launching `authorize()`.

**C-4** Journey=C; Point=ID-token email extraction; Cause=no decoder; Change=`oauthService.decodeIdToken(idToken): { email: string | null }` parses the JWT payload safely (split-and-base64-decode, never validates signature locally — the service is treated as authoritative because the call was just executed).

**C-5** Journey=C; Point=disconnect; Cause=no UI flow; Change=Vault `ServiceCard` triggers `oauthService.disconnect('google')` which calls `tokenService.deleteAllTokensForProvider('google')` after a confirmation modal.

## Journey D: Gmail read

**D-1** Journey=D; Point=`apiClient`; Cause=does not exist; Change=author Axios instance with two interceptors: (1) request interceptor injects bearer token from SecureStore based on a per-call `provider` config field; (2) response error interceptor on 401 calls `oauthService.refreshAccessToken(provider)` exactly once per request (gated by `_retry`), persists new token, replays the original request; on refresh failure, marks the provider as disconnected in vaultStore and throws `SessionExpiredError`.

**D-2** Journey=D; Point=concurrent 401 race; Cause=multiple in-flight 401s would each trigger their own refresh; Change=apiClient maintains a single `inflightRefresh: Map<provider, Promise<string>>` so concurrent failures await the same refresh.

**D-3** Journey=D; Point=Gmail list endpoint; Cause=`googleService.listMessages` does not exist; Change=`GET https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=&q=` then per-id `GET /messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date` returning a `GmailMessageSummary[]`.

**D-4** Journey=D; Point=tool registry; Cause=`gmail_read_recent` schema not declared anywhere; Change=`toolRegistry.ts` declares it with `isDestructive: false`, `parameters: { limit: integer (default 5, max 10), query: string }` and binds it to `tools/gmail.gmailReadRecent`.

**D-5** Journey=D; Point=agent loop; Cause=does not exist; Change=author `agentLoop.run(userMessage)` per the engineering-directive state machine (see PRD §6).

**D-6** Journey=D; Point=systemPrompt; Cause=does not exist; Change=author builder that injects clock, IANA timezone, preferences (from preferencesStore), connected services (from vaultStore), confirmation rule, error-handling rule.

**D-7** Journey=D; Point=tool result formatting; Cause=raw Gmail JSON is too noisy for the LLM; Change=`gmailReadRecent` summarizes each message into `{ id, from, subject, snippet, dateIso }` before returning.

**D-8** Journey=D; Point=ThinkingIndicator / ToolExecutionBadge; Cause=components missing; Change=author both as pure presentational components driven by `chatStore.agentStatus` and `chatStore.currentToolName`.

## Journey E: WhatsApp send (with intermediate contact resolution)

**E-1** Journey=E; Point=contacts permission; Cause=no flow; Change=`tools/contacts.ts` requests `Contacts.requestPermissionsAsync()` on first call; denial maps to `PERMISSION_DENIED` `NexusError` returned semantically to the LLM.

**E-2** Journey=E; Point=contacts search; Cause=no implementation; Change=`searchByName(query: string, limit=3)` reads `Contacts.Fields.Name` + `Contacts.Fields.PhoneNumbers`, case-insensitive substring match, returns top 3 with E.164-normalized numbers.

**E-3** Journey=E; Point=phone-number normalization; Cause=device contacts return free-form strings; Change=`utils/phoneNumber.ts` validates and normalizes to E.164 (`+<countryCode><number>`), rejects anything that cannot be normalized.

**E-4** Journey=E; Point=confirmation gate; Cause=no agent-loop pause; Change=in `agentLoop`, before calling `toolExecutor.execute`, check `toolRegistry.get(toolName).isDestructive`; if true, set `chatStore.pendingAction`, transition to `requires_action`, await `useConfirmation.waitForResolution()` Promise; on cancel, return `{ role: "tool", content: "User cancelled this action." }` to the LLM.

**E-5** Journey=E; Point=ConfirmationCard; Cause=component missing; Change=author component subscribed to `chatStore.pendingAction` rendering `displaySummary` + Confirm/Cancel buttons; never dismisses on backdrop tap (per directive).

**E-6** Journey=E; Point=`whatsappService` and tool — **DEFERRED to Cycle Two** (no WhatsApp Business API for typical beta users). Recorded here so the gap is not forgotten.

## Journey F: Voice input

**F-1..F-5** All voice gaps — **DEFERRED to Cycle Two**. Voice input is a secondary feature and the directive's completeness standard does not require it for the primary journey ("type a natural language command"). Listed here for the next cycle.

## Journey G: Calendar create

**G-1** Journey=G; Point=Calendar API; Cause=`googleService.createCalendarEvent` does not exist; Change=`POST https://www.googleapis.com/calendar/v3/calendars/primary/events` with `summary`, `description`, `start.dateTime`, `start.timeZone`, `end.dateTime`, `end.timeZone`, `attendees: [{email}]`.

**G-2** Journey=G; Point=tool registry destructive flag; Cause=registry missing; Change=`google_calendar_create_event` declared with `isDestructive: true`.

**G-3** Journey=G; Point=`google_calendar_get_next`; Cause=missing; Change=`GET /calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=<now>&maxResults=1`.

## Cross-cutting

**X-1** No `messages` accumulator in the agent loop unless `chatStore` provides it; Change=`chatStore.appendMessage(role, content, toolCallId?)`.

**X-2** No iteration cap enforcement → infinite-loop risk on a malformed LLM response; Change=`agentLoop` runs at most 10 iterations; on overrun, append a synthetic assistant message `"I couldn't complete this in 10 steps. Please rephrase or break it into smaller asks."` and return.

**X-3** No semantic error mapping in the tool executor; Change=`toolExecutor.execute(call)` wraps every executor in try/catch and returns `{ ok: false, error }` mapped to a tool-result string `"Error: <reason>"` consumable by the LLM.

**X-4** No way to read live preferences from `chatStore` consumers without a re-render storm; Change=`preferencesStore.getSnapshot(): Record<string, string>` returns a plain object snapshot for use inside `systemPrompt.build()`.

**X-5** Logger has no PII regex for credit-card-style or postal-address strings — out of scope but flagged.

**X-6** App launches with no error boundary — any thrown render error in any screen would crash the shell; Change=`components/shared/ErrorBoundary.tsx` wraps every screen; its render path uses only safe-allowlisted log fields.

---

**Gap totals: 28 numbered gaps** (some explicitly Deferred to Cycle Two as called out above).
