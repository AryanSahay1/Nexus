# PRD — QA / Diagnostic (Sarah Kim)

**Owner:** Sarah
**Reviewer:** Aaron
**Phase:** 1 + 2
**Ticket:** NX-002

## Goal

Make every future failure mode self-reporting on the device. The user should never need adb or logcat. A single screenshot must convey enough to diagnose.

## Specification

### 1. Native crash sentinel (Phase 1)

A SecureStore key `nexus_last_boot_ok` written immediately after `bootstrap()` returns ok. A second key `nexus_last_boot_attempt` written *before* bootstrap starts. On the next launch, before bootstrap, compare:

```
attempt > ok   → previous launch crashed mid-bootstrap → diagnostic screen
attempt == ok  → previous launch succeeded → normal flow
attempt unset  → first launch ever → normal flow
```

The diagnostic screen rendered on a missing-ok-marker shows:
- The previous launch's bootstrap timestamp
- "Last successful boot" timestamp (if any)
- The retry button + the "Run diagnostic" button (Lin's PRD §2)

### 2. Diag-mode probe table (Phase 2)

Per Lin's PRD §1. Sarah writes the unit tests for each probe to confirm the probe code itself doesn't crash:

```
__tests__/unit/diag.test.ts
  - probe_secure_store: PASS round-trip
  - probe_secure_store: graceful on simulated SecureStore unavailable
  - probe_sqlite_next: PASS open + close
  - probe_sqlite_next: graceful on simulated open failure
  - probe_module_load: react-native-app-auth load is non-throwing
  - probe_module_load: expo-contacts load is non-throwing
  - probe_hermes: returns boolean, never throws
  - probe runner: runs all five sequentially even if one fails
  - probe runner: surfaces typed NexusError.code per failure
```

### 3. User-facing test protocol (sticky)

Authored at `docs/USER_TESTING.md`:

1. Uninstall any prior Nexus from your phone.
2. Download `nexus-0.1.4-android-release.apk` from the v0.1.4 release.
3. Install it. Open Nexus.
4. Three possible outcomes:
   a. **Vault screen appears** → ✅ done.
   b. **Diagnostic screen appears** ("Previous launch crashed") → tap "Run diagnostic" → screenshot the result and send to the team.
   c. **App immediately closes** → close + reopen → diagnostic screen should appear → screenshot.
5. We use the screenshot to identify the failing native module and ship a targeted fix.

### 4. Five gates regression contract

Sarah maintains the Phase-1 regression contract: every existing test from v0.1.3 (270 across 19 suites) must pass through Phase 1 + 2. Any regression blocks the merge.

## Acceptance criteria

- The native crash sentinel is verifiable in unit tests
- The diag-mode probes run from a single function `runDiagProbes(): Promise<DiagReport>` that the screen subscribes to
- `docs/USER_TESTING.md` exists with the three-outcome protocol
- 270 / 270 tests still passing after all Phase 1 + 2 commits
