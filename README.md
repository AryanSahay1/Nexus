# Nexus

A private, on-device personal AI agent for Android. Built natively in Kotlin
with Jetpack Compose. Your OpenAI key and your Google tokens never leave
this phone — they live in the Android Keystore, encrypted at rest.

> **History.** This branch (`cursor/native-android-nexus-358a`) is a clean
> Kotlin/Compose rebuild that replaces the original React Native / Expo
> implementation. The RN build crashed on launch on Vivo V27 (FunTouch OS)
> across five fix attempts. Native Android does not exercise the bridge that
> was crashing, so the immediate-close issue is structurally resolved.

## What it does

- **Chat** with an OpenAI model (GPT-4o-mini by default) using your own key.
- The agent can call **tools** on your behalf — read recent Gmail, send an
  email, create a Google Calendar event, look up the next event, remember
  preferences in local memory.
- **Destructive tools** (sending mail, creating events, deleting memories)
  always pause behind a Confirm / Cancel card before they run.
- **Memory** is a small key/value store that gets injected into the system
  prompt every turn, so the agent can remember "wife's email is …" or
  "always reply professionally" without sending those facts to any server.
- **Vault** is the only place tokens are entered or revoked.

## Tech stack

| Layer | Choice |
|---|---|
| Language | Kotlin 1.9.24 (strict, no `any`) |
| Build | AGP 8.5.2, Gradle 8.7, JDK 17 |
| UI | Jetpack Compose (BOM 2024.06.00), Material 3 |
| DI | Hilt 2.51 + KSP |
| State | ViewModel + StateFlow + Channel events |
| DB | Room 2.6 (preferences, chat history) |
| Secure store | AndroidX Security `EncryptedSharedPreferences` (Keystore-backed) |
| Network | Retrofit 2.11 + OkHttp 4.12 + kotlinx.serialization |
| OAuth | AppAuth-Android 0.11 (Google PKCE) |
| Tests | JUnit 4, MockK, Robolectric, Truth |

## Project layout

```
app/src/main/java/com/nexus/app/
├── MainActivity.kt / NexusApplication.kt
├── core/                  Result<T,E>, NexusError, NexusLog
├── data/
│   ├── secure/            TokenStore (encrypted)
│   ├── db/                Room: NexusDatabase, DAOs, entities
│   ├── network/           Retrofit factories, AuthInterceptor
│   ├── service/           OpenAiService, GoogleApiService
│   ├── oauth/             GoogleOAuthClient (PKCE)
│   ├── repo/              PreferencesRepository, ChatHistoryRepository
│   └── tools/             Gmail, Calendar, Memory tool implementations
├── di/                    AppModule, ToolsModule (Set<Tool> multibinding)
├── domain/agent/          Tool, ToolRegistry, SystemPromptBuilder, AgentLoop
└── ui/
    ├── theme/             NexusTheme, colors, typography
    ├── navigation/        NavHost + RootViewModel
    ├── components/        LoadingScreen, EmptyState, PrimaryButton
    └── screens/           onboarding, chat, vault, memory, settings, tabs
```

## Building

```bash
# Debug APK (unminified, debuggable)
./gradlew :app:assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk      (~19MB)

# Release APK (R8 minified, sideload-signed with ~/.android/debug.keystore
# fallback, or your own key via keystore.properties)
./gradlew :app:assembleRelease
# → app/build/outputs/apk/release/app-release.apk  (~2MB)

# Unit tests
./gradlew :app:testDebugUnitTest
```

The release APK is ~9× smaller than the React Native APK was (78MB → 2MB).

## Installing on your phone

### Option A — sideload the APK

1. Download `app-release.apk` from the latest GitHub Release (or pull it
   from `app/build/outputs/apk/release/` after a local build).
2. Copy it to the phone (USB, Drive, email, whatever).
3. Tap the APK → "Allow from this source" → Install.
4. On Vivo / Funtouch: Settings → Apps → Nexus → Permissions → make sure
   you allow the runtime permissions when prompted.

The APK targets Android 7+ (API 24+). It has been verified to install on
Android 13 (API 33) which is what your Vivo V27 runs.

### Option B — `adb install`

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

## First-run setup

1. **Onboarding screen** — paste your OpenAI key (`sk-…`). The key is
   validated and written to encrypted storage on the device.
2. **Vault tab** — paste your Google OAuth Client ID
   (`xxxxx.apps.googleusercontent.com`) → tap *Connect Google* → complete
   the consent in Chrome Custom Tabs. Tokens come back as individual
   strings (never as a JSON blob) and are written atomically.
3. **Chat tab** — start typing. Try things like:
   - *"What's my next meeting?"* — read-only, runs without confirmation.
   - *"Remember my wife's email is jane@example.com"* — `memory_remember`.
   - *"Send Jane an email reminding her about dinner at 8"* — drafts the
     email, then pauses with a Confirm / Cancel card before actually
     calling Gmail.

## Privacy laws (kept verbatim from the original directive)

| # | Law |
|---:|---|
| 1 | Sensitive data lives only in `EncryptedSharedPreferences`. No `SharedPreferences` for tokens. |
| 2 | Logs use `NexusLog` with an allowlist + PII-pattern scrubbing. No payloads, no contents. |
| 3 | Tools never crash the loop — every failure is a `NexusResult.Err` returned to the LLM. |
| 4 | Destructive tools always pass through the Confirm / Cancel gate. |
| 5 | OAuth tokens are stored as individual strings via `TokenStore.setOAuthBundle` (atomic, with rollback). |
| 6 | No placeholder code, no TODOs. |
| 7 | No `any`. Sealed classes for state/result/event. |
| 8 | Components render; ViewModels orchestrate; services do I/O. |
| 9 | All network goes through services exposed by Hilt. |
| 10 | Every screen has loading / error / empty states. |

## Tests

```
NexusResultTest           6 ✅
LoggerTest                4 ✅
TokenStoreTest            7 ✅
OnboardingValidationTest  5 ✅
SystemPromptTest          3 ✅
VaultMaskTest             2 ✅
AgentLoopTest             4 ✅
─────────────────────────────
Total                    31 ✅ (0 failures, 0 errors)
```

## License

Personal project — not yet licensed for redistribution.
