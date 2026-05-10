# User testing protocol — v0.1.4 on Vivo V27

A 60-second test that produces a definitive screenshot.

## Step 1 — Uninstall any prior Nexus

Long-press the Nexus icon on your home screen → Uninstall. This removes any cached crash state from earlier versions.

## Step 2 — Download v0.1.4 release APK

On your phone, open https://github.com/AryanSahay1/Nexus/releases/tag/v0.1.4 and tap the file named `nexus-0.1.4-android-release.apk` (~78 MB). Approve "unknown developer" if prompted.

## Step 3 — Install + open

Tap Install. When done, tap Open. Wait 10 seconds.

## Step 4 — Three possible outcomes, one screenshot each

### Outcome A — Vault screen appears ✅

You should see "VAULT" in cyan at the top, three service cards (Google, OpenAI, WhatsApp), and a tab bar at the bottom. **Reply with: "v0.1.4 opens — Vault screen visible."** Done.

### Outcome B — Diagnostic screen appears

You will see one of two screens:

**B1 — "Previous launch crashed"** — has a "Run diagnostic" button.
Tap **Run diagnostic**. The next screen runs five probes, each producing ✓ or ✗. Take a screenshot **after all five rows show a final state**. Send the screenshot. The team will know exactly which native module is failing.

**B2 — Direct diag screen** — same five probes shown immediately.
Same — screenshot after probes complete.

### Outcome C — App immediately closes again

Tap the app icon a second time. The diagnostic screen *should* appear because the v0.1.4 native crash sentinel detects that the previous launch did not finish bootstrap. Screenshot.

If even on the second open the app immediately closes, that means either (a) Hermes / native runtime crashes before our crash sentinel runs, or (b) Vivo's iManager / battery / autostart is killing the process. Reply with **"v0.1.4 closes immediately on first AND second open"** and we escalate to Phase 3 (EAS Build path).

## What the team sees from your screenshot

The five probes are stable strings the team will diagnose against:

| Row label | What it means if ✗ |
| --- | --- |
| `expo-secure-store` | iOS Keychain / Android Keystore unreachable on this device |
| `expo-sqlite/next` | SQLite native lib failed to open a file |
| `expo-contacts` | Contacts native module fails to bind |
| `react-native-app-auth` | OAuth native module fails to bind |
| `hermes` | JS engine globals unset — extremely rare; would mean Hermes wasn't loaded at all |

We need ONE screenshot to act on. No adb, no logcat, no developer mode required.

## If you have a developer machine handy

Optional, only if you want to help us escalate fast: connect your phone via USB, run `adb logcat -d | grep -i "AndroidRuntime\|nexus\|expo"` and paste the output. This is faster but not required — the diagnostic screen alone is sufficient for us to ship a targeted fix.
