# PRD — Vivo / OEM (Lin Wei)

**Owner:** Lin
**Reviewer:** Aaron
**Phase:** 2 (diagnostic-mode APK)
**Ticket:** NX-002

## Goal

Build an on-device diagnostic mode that the user can install with no developer tools and that produces a single screenshot definitively naming the failing native module on the Vivo V27.

## Specification

### 1. New diag route

`app/diag.tsx` — a screen that does NOT call `bootstrap()`, does NOT load fonts, does NOT mount the agent, does NOT use Reanimated. Pure RN + safe-area + plain Text. Probes each native module sequentially:

```
[ ] expo-secure-store      <- writes 'nexus_diag' / reads back / deletes
[ ] expo-sqlite/next       <- openDatabaseAsync('diag.db') / closes
[ ] expo-contacts          <- module load only (no permission dialog)
[ ] react-native-app-auth  <- module load only
[ ] hermes                 <- typeof HermesInternal !== 'undefined'
```

Each row shows an emoji indicator (⏳ pending, ✓ pass, ✗ fail) plus the error message inline if it failed, in monospace, all on a single screenshot-able screen.

### 2. Diag entry shortcut

In `_layout.tsx`'s outer try/catch (Maya's PRD §2), if bootstrap fails OR the previous-launch sentinel is missing, the fallback screen contains a button **"Run diagnostic"** that navigates to `/diag` instead of attempting bootstrap.

### 3. No build flag needed

The diag route ships as a hidden tab/route in the same APK; access via the diagnostic-screen button. The user installs the same v0.1.4 APK; if it crashes on launch, then on the second launch the sentinel-missing fallback shows. From there they tap "Run diagnostic" and the rows tell us which module is broken.

### 4. Diag-mode screenshot template

The bottom of the diag screen shows a small monospace string: `nx-diag v<version> · <device-build-fingerprint>` so the user's screenshot includes the build fingerprint (`ro.build.fingerprint`) which Lin can map to a specific FunTouch OS revision.

## Acceptance criteria

- `/diag` route accessible whether or not bootstrap succeeded
- All five module probes run sequentially with on-screen pass/fail
- A failing probe surfaces the typed `NexusError.code` and message inline
- No native crash from a probe causes the diag screen itself to crash (each probe is wrapped in try/catch)
- Screenshot of diag screen on Vivo V27 should have all the info Lin needs without follow-up
