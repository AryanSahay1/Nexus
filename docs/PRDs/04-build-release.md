# PRD — Build & Release (Rafa Castillo)

**Owner:** Rafa
**Reviewer:** Aaron
**Phase:** 1 + 3
**Ticket:** NX-002

## Goal

Reduce the Vivo-V27-installable APK size, harden the gradle invocation against environment drift, and prepare an EAS Build escalation path.

## Specification

### 1. Per-ABI APK splits (optional, phase 3)

Universal APKs are 78 MB because they ship lib/* for all four architectures. arm64-v8a is the only one a 2023+ flagship needs. A split would produce:

- `nexus-<v>-android-arm64-v8a.apk` ≈ 30 MB (recommended for modern devices)
- `nexus-<v>-android-armeabi-v7a.apk` ≈ 28 MB (older 32-bit devices)
- `nexus-<v>-android-x86.apk` ≈ 32 MB (emulators)
- `nexus-<v>-android-universal.apk` ≈ 78 MB (fallback)

Defer this to Phase 3 — the universal APK is sufficient for v0.1.4 testing.

### 2. Build script hardening

`scripts/build-android-apk.sh`:
- Already verifies `assets/index.android.bundle` is present (PR #7)
- Add: verify `lib/arm64-v8a/libexpo-modules-core.so` is present
- Add: verify `lib/arm64-v8a/libhermes.so` OR `lib/arm64-v8a/libjsc.so` is present (one of the two engines)
- Add: print classes.dex count (helps spot dex-merger issues)

### 3. EAS escalation

Document at `docs/EAS_BUILD.md` the exact developer-machine commands to produce an EAS-built APK:

```bash
npm install -g eas-cli
eas login
eas build:configure  # only first time
eas build --platform android --profile preview
```

This produces an APK in Expo's known-good build environment. If the user's local-build crashes on Vivo and the EAS-built APK opens, the gap is the build environment — not the source code. Rafa then aligns local gradle invocation with EAS's by inspecting EAS's build logs.

## Acceptance criteria

- v0.1.4 release APK ships through `scripts/build-android-apk.sh` and passes all extended sanity checks
- `docs/EAS_BUILD.md` exists with the exact commands and what to expect at each step
- A new GitHub Actions workflow_dispatch trigger named "EAS Build (manual)" is documented but not yet automated (developer machine only)
