# Project Nexus

A production-grade, **local-first** mobile AI agent built in React Native (Expo SDK 50). Nexus is a unified command layer for your digital life — reading email, sending messages, managing the calendar, and chaining cross-app workflows — through a natural-language chat interface, using **only your own API keys**, stored in the device's secure enclave.

> Status: **Scaffold + secure token service.** Subsequent subsystems (agent loop, tool executors, OAuth flows, chat UI, vault UI, memory UI) build on top of the contracts established here.

---

## Absolute laws

These ten laws govern every line of code in this repository. They are reproduced verbatim from the engineering directive and enforced through code review and tests.

1. **Never** use AsyncStorage for tokens, keys, or sensitive data. Use `expo-secure-store` exclusively.
2. **Never** log API keys, tokens, or user message payloads anywhere.
3. **Never** crash the app on tool failure. All errors are returned semantically to the LLM.
4. **Never** allow destructive actions without an explicit human-in-the-loop confirmation.
5. **Never** store OAuth tokens as raw JSON blobs in SecureStore — parse and store individual strings.
6. **Never** write placeholder functions. Every function is complete and working.
7. **Never** use `any`. Strict typing at all times.
8. **Never** mix UI state with business logic.
9. **Never** make direct API calls from components.
10. **Never** skip error boundaries.

---

## Project structure

```
nexus/
├── app/                          # expo-router screens (added in subsequent PRs)
├── src/
│   ├── agent/                    # agentLoop, toolRegistry, systemPrompt
│   ├── tools/                    # one file per tool (gmail, whatsapp, ...)
│   ├── services/
│   │   └── tokenService.ts       # ✓ implemented
│   ├── db/
│   │   ├── database.ts           # ✓ implemented (expo-sqlite + migrations)
│   │   └── schema.sql            # ✓ implemented
│   ├── store/                    # zustand stores
│   ├── hooks/                    # useAgentLoop, useVoiceInput, useConfirmation
│   ├── components/               # chat / vault / shared UI primitives
│   ├── types/
│   │   └── auth.ts               # ✓ implemented (Result, NexusError, OAuthToken, ...)
│   └── utils/
│       └── logger.ts             # ✓ implemented (privacy-safe scrubbing)
└── __tests__/
    └── unit/
        └── tokenService.test.ts  # ✓ full test suite
```

---

## Tech stack (locked)

Runtime is **Expo SDK 50 managed workflow** with strict TypeScript. The complete dependency list is in `package.json` and matches the engineering directive exactly. Substitution is not permitted.

| Concern | Package |
| --- | --- |
| Router | `expo-router` v3 (file-based) |
| State | `zustand` ^4.5 |
| Secure storage | `expo-secure-store` ^12 |
| HTTP | `axios` ^1.6 |
| OAuth | `react-native-app-auth` ^7 |
| LLM | `openai` ^4 |
| Local DB | `expo-sqlite` ^13 |
| Contacts | `expo-contacts` ^12 |
| Audio | `expo-av` ^13 |
| Location | `expo-location` ^16 |
| Animation | `react-native-reanimated` ^3 |
| Gestures | `react-native-gesture-handler` ^2 |
| Tests | `jest` + `@testing-library/react-native` + `detox` |

---

## Setup

```bash
npm install
npm run typecheck   # strict TS, no any
npm test            # unit suite (Jest + ts-jest)
npm run lint
```

Real builds:

```bash
npm run ios
npm run android
```

Required env (see `.env.example`): only build-time public values. Every secret lives on-device.

---

## Secure token service

`src/services/tokenService.ts` is the **single source of truth** for credential I/O. It enforces the storage invariants from LAW 1 and LAW 5:

- Keys follow the canonical pattern `nexus_<provider>_<tokenType>`.
- Only **raw strings** are accepted; JSON-shaped values are rejected at write time.
- Values exceeding the iOS Keychain item limit (~2KB) are rejected.
- All operations return `Result<T, NexusError>` — nothing throws across module boundaries.
- The companion `setOAuthBundle()` is the canonical post-`authorize()` helper that parses an OAuth grant into individual SecureStore writes.

The full test suite in `__tests__/unit/tokenService.test.ts` exercises:

- key construction uniqueness
- input validation (non-strings, empty, oversized, JSON blobs)
- store / retrieve / delete (success + native failures)
- token rotation via `setOAuthBundle`
- per-provider deletion that preserves other providers
- vault snapshots for connected / disconnected status
- `wipeAllCredentials`
- logging hygiene — confirms tokens never appear in console output

---

## Next subsystems (not in this PR)

In dependency order:

1. `apiClient.ts` — Axios with the 401 refresh interceptor.
2. `oauthService.ts` — react-native-app-auth PKCE flows for Google.
3. `agent/toolRegistry.ts` + `tools/*.ts` — first-class tool definitions.
4. `agent/agentLoop.ts` — recursive loop with the `requires_action` pause.
5. `app/_layout.tsx` + `(tabs)/index.tsx` + `(tabs)/vault.tsx` + `(tabs)/memory.tsx` — UI.
6. Detox E2E coverage for the chat flow.
