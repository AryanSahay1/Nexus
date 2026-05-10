# NexOS — local-first AI note-taking, native Android

> Capture the screen or your voice, let the AI shape it, store everything on-device.

NexOS is a native Kotlin + Jetpack Compose Android app built from the master plan's **Vision & PRD** and **Architecture** sections, following the Android Full-Stack and UI/UX Motion Design skills.

It lives **alongside** the React Native `Nexus` app in this repository — they don't share code or runtime; the two builds simply live in different folders.

| Folder | Build |
|---|---|
| `nexos/` | This native Android app (Kotlin + Compose) |
| `app/`, `src/` (repo root) | The React Native / Expo `Nexus` app |

---

## What it does

- **Floating bubble** anywhere on screen → tap to expand quick-actions for screenshot or voice.
- **Screenshot capture** via `MediaProjection` → ML Kit OCR extracts text → optional AI provider summarises into title + bullets + summary → stored as a Note in Room.
- **Voice capture** via `SpeechRecognizer` → same AI/summary pipeline → stored as a Note.
- **Optional bring-your-own-key** for OpenAI / Gemini / Anthropic / Groq. Keys are stored in `EncryptedSharedPreferences` (AES-256-GCM); no key is hardcoded, none ship in the APK, and none touch logs.
- **Works offline.** Without an API key, NexOS uses a deterministic rule-based summariser — title from the first non-blank line, bullets from each cleaned line, summary from the leading sentence.
- **Local-first.** Every note lives in the device's Room database. There is no backend.

---

## Tech stack

| Concern | Choice |
|---|---|
| Language | Kotlin 1.9.24 (100%, no Java) |
| UI | Jetpack Compose (BOM 2024.06.00, Compose Compiler 1.5.14) |
| DI | Hilt 2.51.1 |
| DB | Room 2.6.1 |
| Network | Retrofit 2.11 + OkHttp 4.12 + Gson |
| Secure store | `androidx.security:security-crypto` (AES-256-GCM master key) |
| OCR | ML Kit text-recognition 16.0.0 |
| Voice | `android.speech.SpeechRecognizer` (system) |
| Min SDK / Target SDK | 26 / 34 |
| Theme | Dark-first, accent `#00E676`, surface `#0D0D1A`, base `#07070F` |

---

## Architecture (MVVM + Clean)

```
UI (Compose) ─► ViewModel (StateFlow) ─► NexosOrchestrator
                                              │
                  ┌───────────────────────────┼───────────────────────────┐
                  ▼                           ▼                           ▼
            OcrEngine (ML Kit)        AIRouter → AIProvider          NoteRepository → Room
                                          │
                          ┌───────────────┼────────────────┐
                          ▼               ▼                ▼
                      OpenAI / Gemini / Anthropic / Groq / NoOp
```

- ViewModels never see Android framework types except `ViewModel`/`SavedStateHandle`/`Application`.
- Screens never call repositories directly — always through a ViewModel.
- Long-running work runs on `Dispatchers.IO`; SpeechRecognizer is pinned to the main thread per the Android contract.
- `ScreenshotService` (foregroundServiceType=mediaProjection) and `FloatingButtonService` (foregroundServiceType=specialUse on API 34+) declare the right service types per API level.
- All `PendingIntent`s are `FLAG_IMMUTABLE` (API 31+ requirement).

---

## Motion design system

All animations follow the master skill's golden rules — only `transform`/`opacity`-equivalent properties (alpha, scale, translation), durations in the **80–500 ms** band, easing tokens centralised in `presentation/ui/theme/Motion.kt`.

| Component | Motion |
|---|---|
| `AuroraBackground` | Radial mesh gradient drifting on an 18 s loop |
| `PulsingDot` | Looping scale + opacity pulse for status |
| `ShimmerBlock` / `SkeletonCard` | Linear gradient shimmer for loading |
| `PrimaryButton` / `GhostButton` | Press scale-down (0.97) micro-interaction |
| `NoteCard` | Fade + expand entrance per item |
| `WorkflowToast` | Slide-up + fade with springy easing |
| `FloatingButtonService` bubble | Overshoot entrance, edge-snap with `OvershootInterpolator`, expanded action row on tap |
| Compose nav graph | Slide + fade transitions for forward/back |

---

## Build it yourself

```bash
cd nexos
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleRelease     # produces app/build/outputs/apk/release/app-release.apk
./gradlew :app:assembleDebug       # produces app/build/outputs/apk/debug/app-debug.apk
```

Pre-built artefacts are checked in under [`dist/`](./dist/) for convenience.

Both APKs are signed with an auto-generated debug keystore. Replace with a real Play Store keystore by adding a `keystore.properties` at the project root (the build script will pick it up automatically).

---

## File layout

```
nexos/
├── build.gradle.kts                 (root)
├── settings.gradle.kts
├── gradle.properties
├── gradle/wrapper/...
├── dist/                            (committed pre-built APKs)
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── res/{drawable,mipmap-anydpi-v26,values,xml}
        └── java/com/nexos/ai/
            ├── NexosApp.kt, MainActivity.kt
            ├── ai/                  AI provider layer + prompts + helper
            ├── data/
            │   ├── local/           Room: NexosDatabase + dao + entity
            │   ├── remote/          Retrofit APIs + DTOs
            │   ├── repository/      NoteRepository, SettingsRepository
            │   ├── mapper/          Entity ↔ Domain conversion
            │   └── secure/          EncryptedSharedPreferences API key vault
            ├── di/AppModule.kt      Hilt providers
            ├── domain/model/        Pure-Kotlin domain types
            ├── ocr/                 ML Kit OCR + TextCleaner
            ├── voice/               SpeechRecognizer wrapper
            ├── service/             Foreground services + receiver + notification channels
            ├── util/                NexosOrchestrator, PermissionManager, Extensions
            └── presentation/
                ├── ui/              Composable screens + components + theme
                └── viewmodel/       NotesViewModel, NoteDetailViewModel, SettingsViewModel
```
