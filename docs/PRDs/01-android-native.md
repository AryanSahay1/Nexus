# PRD — Android Native (Hari Subramanian)

**Owner:** Hari
**Reviewer:** Aaron
**Phase:** 1 (risk-surface reduction)
**Ticket:** NX-002

## Goal

Eliminate ProGuard / R8 as a variable in the v0.1.4 release APK. Ensure all four ABIs (arm64-v8a, armeabi-v7a, x86, x86_64) are included so a Vivo V27's primary architecture (arm64-v8a) is unambiguously present.

## Specification

### 1. Disable ProGuard in release builds

`android/gradle.properties` after prebuild contains a line `android.enableProguardInReleaseBuilds=true|false`. Confirm it is `false`. If our build template has flipped it to `true`, override via the prebuild config.

### 2. Confirm ABI inclusion

`android/app/build.gradle` must NOT contain an `abiFilters` entry that strips arm64-v8a. The default packaging splits per ABI but the universal APK must include all four.

### 3. Manifest sanity

`android/app/src/main/AndroidManifest.xml` `<application>` must:
- Have `android:allowBackup="true"` for first-launch friendliness
- NOT export `MainActivity` to other apps unintentionally
- Have correct `appAuthRedirectScheme` placeholder (this was injected by `plugins/with-app-auth-android.js` in PR #5)

### 4. Verification

- `unzip -l release-apk | grep "lib/arm64-v8a/libexpo-modules-core.so"` returns 1 line
- `unzip -l release-apk | grep "classes.dex"` returns at least 1 line
- `aapt dump badging release-apk | head -3` shows correct package name + versionCode

## Acceptance criteria

- v0.1.4 release APK has a different sha256 from v0.1.3 (proves rebuild)
- ProGuard is disabled (verified by inspecting unobfuscated class names with `apktool dump`)
- arm64-v8a libs present and unstripped
