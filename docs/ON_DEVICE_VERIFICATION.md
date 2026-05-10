# Nexus — on-device verification checklist

**Target device:** Vivo V27 (FunTouch OS / Android 13).  
**Tester:** the developer (this checklist is run **manually** with the
phone in hand — no CI emulator can reproduce all of the device-level
quirks the V27 has shown in the past).

The checklist is partitioned into nine sections that mirror the
subsystems Nexus ships. Tick each box as you go. **Do not skip ahead** —
the later sections assume earlier sections succeeded.

---

## SECTION 1 — Pre-install

```
[ ] Uninstall any prior Nexus APK from the device:
       Settings → Apps → Nexus → Uninstall
       (verify by searching for "Nexus" in the app drawer afterwards)

[ ] Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env BEFORE building:
       cp .env.example .env
       # edit .env — paste the Google OAuth Client ID from
       # https://console.cloud.google.com → APIs & Services → Credentials

[ ] Build the release APK (from a clean checkout):
       npm ci --legacy-peer-deps
       npx expo prebuild --platform android --clean
       cd android && ./gradlew assembleRelease

[ ] Install the APK over USB:
       adb install -r android/app/build/outputs/apk/release/app-release.apk

[ ] Confirm the installer reports SUCCESS and the Nexus icon appears in
    the app drawer.
```

---

## SECTION 2 — Boot sequence

```
[ ] App opens without a red screen of death.
[ ] Splash screen appears for ≤ 1 s, then transitions to the Vault tab
    (Vault is the start tab when no API key is configured).
[ ] No "NativeModule not found" / "Unable to load script" errors in:
       adb logcat -d | grep -iE "nativemodule|unable to load"
[ ] The five fonts load — verify visually by checking that the
    "Chat / Vault / Memory" tab labels render in custom typefaces
    (not the system default sans-serif). The packed fonts are Syne,
    Outfit, JetBrains Mono.
```

---

## SECTION 3 — Google auth

```
[ ] Tap "Connect Google" on the Vault tab.
       → A Chrome Custom Tab opens to accounts.google.com.
[ ] Complete the Google login.
       → The tab closes and Nexus comes back to the foreground.
[ ] Vault now shows the connected Google email (e.g. jane@example.com).
[ ] Force-stop the app (Recents → swipe up on Nexus card).
[ ] Reopen Nexus.
       → Google is still connected. NO re-login is required.
[ ] Confirm no bearer token leaks to logs:
       adb logcat -d | grep -i "Bearer"
       (expected output: 0 matches)
```

---

## SECTION 4 — Chat

```
[ ] Open the Chat tab.
[ ] Type "What is on my calendar tomorrow?" and tap Send.
       → TypingIndicator appears (animated dots).
[ ] Agent response appears beneath the typing indicator within ~5 s.
[ ] Force-stop the app.
[ ] Reopen Nexus → Chat tab.
       → Chat history is visible — both the user prompt and the agent
         reply are still there.
[ ] Type "send a test email to test@example.com saying hello".
[ ] ConfirmationSheet slides up from the bottom.
       → It shows the recipient, subject, and body — NOT just a
         generic "send email?" prompt.
[ ] Tap Cancel.
       → ConfirmationSheet closes. NO email is sent.
       → Verify by checking Sent in Gmail manually.
[ ] Repeat the prompt → tap Confirm.
       → ConfirmationSheet closes.
       → Within 10 s, an "✓ Sent to test@example.com" affordance
         appears in the chat thread.
       → Verify the email actually arrived in the recipient's inbox.
```

---

## SECTION 5 — Mail + Calendar

```
[ ] Tap the Mail tab.
       → Inbox loads. The first 10 threads from Gmail are visible.
[ ] Tap any email row.
       → Detail view opens with the full body (not just headers).
[ ] Pull down on the inbox to refresh.
       → A spinner appears, then the list reloads.

[ ] Tap the Calendar tab.
       → Today's events load.
[ ] Long-press any event.
       → A context menu appears with "Schedule reminder".
[ ] Tap "Schedule reminder".
       → A toast confirms the reminder is scheduled.
[ ] Lock the phone and wait until the configured reminder time.
       → A heads-up notification fires from Nexus at the correct
         minute (give or take ~30 s for Doze to wake).
```

---

## SECTION 6 — Voice input

```
[ ] On the Chat tab, tap the microphone icon to the LEFT of the input
    bar.
       → On first use only: a system permission prompt appears.
       → Grant microphone access.
[ ] The mic icon turns red and pulses while you speak (Reanimated
    animation; verify the scaling is smooth, not a freeze-frame).
[ ] Say "Tell me a joke" out loud, then tap the mic again.
       → Mic stops pulsing. A "…" briefly replaces the icon while
         transcription happens.
       → The input bar fills with the recognised text.
[ ] Tap Send.
       → The agent replies with a joke. (Verifies the full Whisper →
         input bar → agent loop pipeline.)
```

---

## SECTION 7 — WhatsApp

```
[ ] Open the Chat tab.
[ ] Type "Send a WhatsApp to +1234567890 saying hello from nexus".
[ ] ConfirmationSheet appears.
       → It shows BOTH the phone number and the exact message body.
[ ] Tap Cancel.
       → Sheet closes. WhatsApp does NOT open.
[ ] Repeat the prompt → tap Confirm.
       → WhatsApp opens with the message pre-filled in the chat with
         that number. (You still have to tap WhatsApp's own send
         button — that's by design; we never auto-send.)
```

---

## SECTION 8 — Security spot-checks

```
While the app is running, in a separate terminal connected via adb:

[ ]   adb logcat -d | grep -i "bearer"   → expected: 0 matches
[ ]   adb logcat -d | grep -i "sk-"      → expected: 0 matches
[ ]   adb logcat -d | grep -i "password" → expected: 0 matches

If any of these returns ≥ 1 match, **stop the verification** and file
the offending log line as a LAW 2 regression bug — Nexus must never
emit credential-shaped strings to the device log.
```

---

## SECTION 9 — Sign-out

```
[ ] Open Settings (or the Vault tab depending on build).
[ ] Tap "Disconnect Google" → confirm.
       → Vault flips Google to "Disconnected" and the email row
         disappears.
[ ] Force-stop Nexus and reopen.
       → No auto-login attempt occurs. The "Connect Google" button is
         visible again on the Vault tab. (Or, if EXPO_PUBLIC_GOOGLE_CLIENT_ID
         is unset, the yellow setup pill appears instead.)
```

---

## What "passing" means

Every box in every section is ticked, no LAW-2 regressions surfaced in
section 8, and the app survives at least one full force-stop-and-reopen
cycle in each of sections 3, 4, and 9 without re-authentication and
without losing chat history.

If anything fails, capture:

```
adb logcat -d > /tmp/nexus.logcat.txt
```

…and attach it to the bug report. The privacy-safe logger in
`src/utils/logger.ts` only emits scrubbed JSON; raw stack traces from
crashes will appear as Android system logs and may include genuine
device info that should be redacted before sharing externally.
