# NexOS pre-built APKs

| Variant | File | Size | Min SDK | Notes |
|---|---|---|---|---|
| Release | `nexos-1.0.0-release.apk` | ~25 MB | 26 (Android 8.0) | R8-minified + resource-shrunk. Signed with the on-device debug keystore — replace before Play Store submission. |
| Debug | `nexos-1.0.0-debug.apk` | ~37 MB | 26 (Android 8.0) | No minification; identical permissions and behaviour. Application ID is `com.nexos.ai.debug` so it can install side-by-side with the release. |

Install on a real device (MediaProjection + foreground services do not work on most emulators):

```bash
adb install -r dist/nexos-1.0.0-release.apk
```

Both APKs are unmodified outputs from `./gradlew :app:assembleDebug` and `:app:assembleRelease`. Reproduce locally:

```bash
cd nexos
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleRelease
```

Outputs land in `app/build/outputs/apk/{debug,release}/`.
