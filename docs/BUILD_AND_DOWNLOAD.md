# Build and Download Nexus

There are three ways to get Nexus running on a real phone, in increasing order of effort.

| Path | Time | Result | Cost |
| --- | --- | --- | --- |
| **A.** Sideload the prebuilt Android APK | ~2 min | App installed on Android | Free |
| **B.** Build it yourself with EAS Build | ~15 min | Signed APK or AAB on Android, IPA on iOS | Free tier |
| **C.** Run from source via Expo Go | ~5 min | Live-reload dev experience on either platform | Free |

You only need to do path A, B, *or* C. Pick whichever fits your situation.

---

## Path A — Sideload the prebuilt Android APK

This is the fastest path if you have an Android phone.

### Where to find the APK

Each tagged release attaches the APK as a release asset on GitHub:

> https://github.com/AryanSahay1/Nexus/releases

Download the file named `nexus-<version>-android-debug.apk` directly to your Android device (Chrome, Firefox, or any browser).

> The APK is **debug-signed**. Android will warn that it's "from an unknown developer" — that's expected. The signing certificate is the standard Android debug keystore. The release pipeline does not (yet) ship a Play Store-signed AAB; for that, use Path B.

### Install it

1. On your Android phone, open the file you just downloaded.
2. The first time you sideload anything, Android asks for permission to "Install unknown apps" for the browser you used. Approve, then return to the file and tap Install.
3. Open the Nexus icon. The Vault screen will appear immediately (because nothing is configured yet).
4. Follow [`docs/GOOGLE_SETUP.md`](./GOOGLE_SETUP.md) to create your free Google OAuth client ID, then in the app:
   - Paste your OpenAI / Groq API key into the OpenAI tile.
   - The Connect Google flow needs the client ID embedded at build time, so for sideload paths you'll want to follow Path B (build your own with the client ID embedded).

> If you only intend to use OpenAI / Groq and not Google, the sideload APK works as-is.

### Uninstall

Long-press the Nexus icon → App info → Uninstall. SecureStore + the app sandbox are removed cleanly.

---

## Path B — Build it yourself with EAS Build

This path produces a properly signed APK or AAB (Android), or IPA (iOS), with your own Google client ID embedded.

### Prerequisites

- Node 22 (or any LTS)
- A free Expo account at https://expo.dev (sign-up takes a minute)

### Steps

```bash
# 1. Clone
git clone https://github.com/AryanSahay1/Nexus
cd Nexus
npm install --legacy-peer-deps

# 2. Set up your Google client id (one-time, free — see docs/GOOGLE_SETUP.md)
cp .env.example .env
# edit .env — set EXPO_PUBLIC_GOOGLE_CLIENT_ID

# 3. Install + log into EAS
npm install -g eas-cli
eas login

# 4. Configure the build (one-time)
eas build:configure

# 5. Build the binary
#    - Android APK (sideload):
eas build --platform android --profile preview

#    - Android AAB (Play Store):
eas build --platform android --profile production

#    - iOS (requires Apple Developer account, $99/yr):
eas build --platform ios --profile production
```

EAS runs the build on Expo's infrastructure (free tier covers ~30 builds/month). When it finishes, it gives you a URL — download the APK and install it the same way as Path A, or follow the EAS instructions to publish to the Play Store / App Store.

### What's in `eas.json`

The repository ships an [`eas.json`](../eas.json) with three profiles:

- `development` — debug build with the Expo Dev Client for hot-reload
- `preview` — release-mode APK, ideal for internal testing
- `production` — Android App Bundle + iOS production build, ready for store submission

---

## Path C — Run from source via Expo Go

If you just want to play with the app and don't care about producing a binary, this is the fastest path.

### Prerequisites

- Node 22
- Expo Go installed on your phone (search "Expo Go" on the App Store / Play Store, free)
- Your phone and computer on the same Wi-Fi network

### Steps

```bash
git clone https://github.com/AryanSahay1/Nexus
cd Nexus
npm install --legacy-peer-deps

# (Optional) set EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env if you want the
# Connect Google button to work — see docs/GOOGLE_SETUP.md.
cp .env.example .env

npx expo start
```

A QR code will appear in the terminal. Scan it with the Expo Go app on your phone, and Nexus will boot.

> Caveat: a few native modules (`react-native-app-auth`, `expo-haptics`, etc.) require a native build to function fully. Expo Go ships with most of them; the Connect Google flow may fall back to a web browser instead of an in-app sheet on Expo Go specifically. For full-fidelity behavior, use Path B.

---

## Building the APK locally (advanced)

If you don't want to use EAS and don't want the prebuilt sideload APK, you can build locally:

```bash
git clone https://github.com/AryanSahay1/Nexus
cd Nexus
npm install --legacy-peer-deps
npx expo prebuild --platform android --clean

cd android
./gradlew assembleDebug      # or assembleRelease, with a signing key
ls -lh app/build/outputs/apk/debug/app-debug.apk
```

This requires the Android SDK (cmdline-tools, platform-tools, platforms;android-34, build-tools;34.0.0) and JDK 17 or 21 on the build machine. The same toolchain the upstream release pipeline uses.

---

## What gets stored where, on your device

| Data | Storage | Encrypted? |
| --- | --- | --- |
| OpenAI API key | iOS Keychain / Android Keystore via `expo-secure-store` | Yes (OS-level) |
| Google access + refresh tokens | iOS Keychain / Android Keystore via `expo-secure-store` | Yes (OS-level) |
| User preferences (key/value memories) | App-private SQLite at `<appdata>/SQLite/nexus.db` | iOS Data Protection / Android app sandbox |
| Chat history | Same SQLite | Same |

Nothing leaves the device except as the literal payload of an OpenAI or Google API call you initiated. No telemetry. No analytics. No third-party SDKs.

---

## Uninstall = factory reset

Uninstalling the app removes:
- All SecureStore entries (the app's keychain partition is deleted)
- All SQLite data (the app sandbox is deleted)
- All cached assets

The Connect Google permission you granted on Google's side persists — to revoke it, visit https://myaccount.google.com/permissions and remove **Nexus**. Same for OpenAI keys: rotate them at https://platform.openai.com/api-keys.
