# NexOS

> AI-orchestrated capture & notes for Android. Tap a floating button anywhere
> to OCR your screen into a structured note, or hold to record a voice note —
> all summarized by your choice of AI provider (or 100% on-device).

NexOS lives entirely on your phone. Your API keys live in the platform's
EncryptedSharedPreferences (AES-256-GCM, backed by AndroidKeyStore). Notes
live in a local Room database. Nothing leaves the device except the literal
HTTP payload of an AI call **you** authorized in Settings.

---

## Stack

| Layer            | Choice |
|------------------|---|
| Language         | Kotlin 1.9.21 (100% — no Java) |
| UI               | Jetpack Compose (Compose BOM 2024.01.00) — no XML layouts |
| Architecture     | MVVM + Clean (UseCase → Repository → Room / Retrofit) |
| DI               | Hilt 2.48.1 + KSP |
| Local storage    | Room 2.6.1 |
| Secure storage   | androidx.security 1.1.0-alpha06 (EncryptedSharedPreferences) |
| Networking       | Retrofit 2.9 + OkHttp 4.11 + Gson |
| OCR              | ML Kit Text Recognition (latin) |
| Voice            | Android SpeechRecognizer (main-thread, offline-preferred) |
| Screen capture   | MediaProjection + ImageReader + VirtualDisplay |
| Min SDK / Target | 26 (Android 8.0) / 34 |
| Build            | Gradle 8.5 (Kotlin DSL) + AGP 8.2.2 |

## App features

- **Floating capture button** — tap = screenshot+OCR, hold = voice note.
  Idle pulse, press-shrink, magnetic snap-to-edge, draggable anywhere.
- **Screenshot → OCR → AI → note** pipeline via `NexosOrchestrator`.
- **Optional AI providers**: OpenAI (`gpt-4o-mini`), Gemini (`1.5 Flash`),
  Anthropic (`claude-haiku`), Groq (`llama3-8b`). With no key, NexOS runs a
  deterministic local fallback that mimics the JSON shape.
- **Material 3 dark theme** built with NexOS motion tokens
  (durations 80–700 ms, easings per UX-in-Motion).
- **Compose motion** throughout: staggered list entry, hero hover orbs,
  cross-fade screen transitions, animated workflow capsule, ambient empty-state.
- **Settings**: provider picker with masked keys + Test connection,
  workflow toggles, floating-button side.
- **Onboarding** with permission flow (overlay → mic → notifications → battery).

## Architecture

```
UI (Compose) ⇄ ViewModel ⇄ UseCase ⇄ Repository ⇄ Room / Retrofit / DataStore
                                                       ↑
                                       Orchestrator (Service / Receiver entry)
```

See [`app/src/main/java/com/nexos/ai/`](app/src/main/java/com/nexos/ai/) for
the canonical layout described in the build skill.

## Build

Prerequisites: Android Studio Iguana+ (or Gradle 8.5 + Android SDK 34 +
JDK 17).

```bash
cd nexos
./gradlew :app:assembleDebug
# APK at: app/build/outputs/apk/debug/app-debug.apk
```

Open the `nexos/` folder in Android Studio for full IDE support. Make sure
to install:
- Android SDK Platform 34
- Build-Tools 34.0.0
- Platform-Tools

Tested device target: any Android 8.0+ phone. Real device required for
MediaProjection (emulator does not faithfully support it).

## Project layout

```
nexos/
├── app/
│   ├── src/main/AndroidManifest.xml
│   ├── src/main/java/com/nexos/ai/
│   │   ├── NexosApp.kt              ← @HiltAndroidApp
│   │   ├── MainActivity.kt
│   │   ├── data/
│   │   │   ├── local/               ← Room
│   │   │   ├── remote/              ← Retrofit DTOs + APIs
│   │   │   └── repository/
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   └── usecase/
│   │   ├── presentation/
│   │   │   ├── ui/{notes,settings,voice,onboarding,components,theme}
│   │   │   ├── viewmodel/
│   │   │   └── navigation/
│   │   ├── ai/                      ← AIProvider + Router + 4 implementations
│   │   ├── ocr/                     ← ML Kit wrapper + cleaner
│   │   ├── voice/                   ← SpeechRecognizer wrapper
│   │   ├── service/                 ← Floating button, MediaProjection, receiver
│   │   ├── util/                    ← Orchestrator, secure storage, extensions
│   │   └── di/                      ← Hilt modules
│   └── src/main/res/                ← strings, themes, drawables, xml configs
├── build.gradle.kts                 ← project-level
├── settings.gradle.kts
└── gradle/wrapper/                  ← Gradle 8.5
```

## Security

API keys are written through
[`SecureStorage`](app/src/main/java/com/nexos/ai/util/SecureStorage.kt) using
AES-256-GCM EncryptedSharedPreferences. They are never logged, never sent to
backups (see `xml/backup_rules.xml` + `xml/data_extraction_rules.xml`), and
never present in any `BuildConfig` field.

No telemetry. No analytics. No remote backend.

---

*Built per the NexOS AI Master Skill and UI/UX Motion Design Skill.*
