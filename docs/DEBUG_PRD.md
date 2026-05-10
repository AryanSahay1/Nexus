# Nexus — Debug PRD (post-rebuild check-up)

This document records every defect discovered during the back-and-forth
debugging pass on the native Android Nexus rebuild
(`cursor/native-android-nexus-358a`), classified by severity, with the fix
applied.

## Methodology

1. `./gradlew :app:lintDebug` — Android Lint, full report
2. `./gradlew :app:assembleRelease` — R8 minification + signing
3. `apksigner verify --print-certs` — signing scheme audit
4. Merged `AndroidManifest.xml` review (debug + release)
5. Manual code review of: agent loop, ChatViewModel, OAuth client,
   theme, manifest, tools, Hilt graph
6. APK contents inspection (`unzip -l`)

## Defect register

Severity legend: **P0** crash/correctness/security · **P1** important UX/correctness ·
**P2** cleanup/lint.

| ID | Sev | Where | Defect | Fix |
|---|---|---|---|---|
| B-3 | **P0** | `ChatViewModel.sendMessage` | History snapshot is loaded *after* the user message has been appended; agent loop then prepends `userMessage` again → OpenAI receives the user's last turn **twice**. The `.filter { it.role != "user" \|\| it != userMessage }` compares a `ChatMessageDto` to a `String`, never matches, so the de-dup is a no-op. | Persist the user message *after* the agent loop returns, not before. |
| B-5 | **P0** | `ChatViewModel.appendUiMessage` | `idCounter` starts at 0 on every process restart while messages restored from DB are keyed `idx + 1` (1, 2, 3…). The next user message gets id `1` — **duplicate `LazyColumn` keys → IllegalStateException** when scrolled. | Initialise `idCounter` from `snapshot.size` after the load. |
| B-6 | **P0** | `RootViewModel` / `NexusApp` | While `resolveStartDestination()` is in flight, `state.startDestination` defaults to ONBOARDING — already-authenticated users see a flash of the onboarding screen and the navigator may be torn down with a back-stack mid-replacement. | Render a `LoadingScreen` until `isLoading == false`; only then build the `NavHost`. |
| B-24 | **P0** | `SettingsViewModel.confirmReset` | Wipes secure store + DB but does not navigate. App stays on the Settings tab with no working tokens. The chat tab now crashes on send because there is no API key. User has no path back to onboarding without killing the app. | Expose a `restartRequired` event; root layout observes the OpenAI key and re-routes to onboarding. |
| B-31 | **P0** | `data/network/AuthInterceptor` | No 401-refresh path. When Google access token expires (~1 h after grant), every Gmail/Calendar tool call returns 401 and the agent loop emits a permanent failure. | Add a synchronous refresh in the interceptor: read refresh token, call `https://oauth2.googleapis.com/token`, persist the new access token, replay the request. Single-flight via a `Mutex`. |
| B-2 | **P1** | `VaultViewModel` | Stores Google OAuth Client ID in `Provider.Google + TokenType.ApiKey` slot — semantically wrong (mixes Client ID and bearer token namespaces). | Add `TokenType.ClientId`. |
| B-12 | **P1** | `data/tools/*` | Tool result JSON is built by string concatenation of arbitrary Gmail/Calendar fields. A `"` or `\n` in a subject line breaks the JSON sent back to the LLM. | Build with `kotlinx.serialization.json.buildJsonObject`/`JsonObject` so quotes are escaped properly. |
| B-15 | **P1** | `ui/theme/Theme.kt` | Custom private `Color.toArgb()` shadows Compose's official `androidx.compose.ui.graphics.toArgb`. Works today but loses precision and hides intent. | Import the official extension; delete the local one. |
| B-18 | **P1** | `VaultScreen` / `VaultViewModel` | `setGoogleClientId` writes to `EncryptedSharedPreferences` on every keystroke. EncryptedSharedPreferences I/O is non-trivial; on slower devices typing visibly lags. | Hold draft in UI state only; persist on Connect / disconnect / explicit save. |
| B-20 | **P1** | `ChatViewModel.sendMessage` | On agent error, the user's typed message is shown in the UI but never persisted — disappears on next launch. | Persist the user message even on error path (after history snapshot is captured). |
| B-30 | **P1** | `app/build.gradle.kts` signing | APK signed with v2 only. v1 (JAR) signing is required for installs on API 24–25. | Enable both v1 + v2 in `signingConfigs.release` (`enableV1Signing = true`, `enableV2Signing = true`). |
| B-1 | P2 | `GoogleOAuthClient.handleAuthResponse` | `clientId` parameter is unused (kotlinc warning). | Remove the parameter. |
| B-17 | P2 | `OnboardingScreen.kt` | Local `@Composable private fun stringResource(id)` wraps the official one. | Drop the wrapper, import the real one. |
| B-23 | P2 | `MemoryViewModel.delete` | After delete, the still-typed key/value drafts remain. | Clear drafts on successful save (already done) — no further action needed. |
| B-25 | P2 | `app/build.gradle.kts` | `androidx.datastore:datastore-preferences` and `coil-compose` are pulled in but never referenced. | Remove. |
| L-* | P2 | `ic_launcher`, modifier ordering, redundant manifest label | 38 lint warnings (unused resources, modifier-parameter ordering, redundant `android:label` on activity, `MonochromeLauncherIcon`). | Remove unused strings/colors, swap modifier param order, drop activity label. The monochrome launcher icon is non-blocking; documented as a follow-up. |

## Acceptance criteria for this pass

- `./gradlew :app:lintDebug` returns **0 errors** and the **38 warnings reduce to ≤10** (the residual being upstream "newer dependency available" notices that are not introduced by us).
- `./gradlew :app:testDebugUnitTest` — **all 31 tests still pass plus 4 new tests** for the duplicate-message bug, idCounter starting offset, and JSON-escape on tool results.
- `./gradlew :app:assembleRelease` — succeeds and the APK is signed with **both v1 and v2** (`apksigner verify` reports both true).
- Manual reasoning shows that opening the app with a saved key never flashes the onboarding screen.
- Manual reasoning shows that a Gmail call after token expiry refreshes silently and replays the original request once.
