# PRD — Lead Mobile Architect (Aaron Cole)

**Owner:** Aaron
**Reviewer:** the user
**Phase:** all
**Ticket:** NX-002

## Goal

Coordinate the five departments toward a single deliverable: a v0.1.4 APK that opens on the user's Vivo V27. Maintain falsifiability — every commit eliminates a hypothesis.

## Hypothesis matrix (signed by all six engineers at kickoff)

| # | Hypothesis | Probability | Falsified by |
| --- | --- | --- | --- |
| ~~H1~~ | ~~ProGuard stripping a React Native or Expo bridge class at release time~~ | **0%** | **Eliminated by direct inspection: `android.enableProguardInReleaseBuilds` defaults to `false`. ProGuard was never running.** The 78 MB → 187 MB delta between release and debug is purely the debug-build extra tooling (dev menu, multidex split, etc.). |
| H2 | `react-native-app-auth` native init throws on Vivo's WebView during module-level import | 35% | Phase 1 — lazy-require AppAuth; if v0.1.4 still crashes, this is eliminated as the sole cause |
| H3 | `expo-contacts` native init crashes during module-level import | 15% | Phase 1 — same lazy-require pattern |
| H5 | Hermes JS bundle parsing fails before React Native's error UI can render | 25% | Phase 2 — diag-mode APK that bypasses bootstrap; if it also crashes, escalate H5 |
| H6 | Vivo iManager / battery saver / autostart disables the app pre-launch | 10% | Phase 2 — Lin tests on FunTouch directly |
| H7 | Build environment drift between local gradle and Expo's EAS Build | 10% | Phase 3 — EAS-built APK opens, local does not |
| H8 | A native module bridge throws during `MainApplication.onCreate` package registration on Vivo's NDK runtime | 5% | Phase 2 — diag-mode APK shows individual probe failures |

## Phase gates

| Phase | Eliminates | Confirms working if | Escalates if |
| --- | --- | --- | --- |
| 1 | H1, H2, H3, H4 | v0.1.4 opens to Vault | go to phase 2 with H5/H6 still in play |
| 2 | H5, H6 | diag screen appears with all probes ✓ but app still crashes (H6) | go to phase 3 |
| 3 | H7 | EAS-built APK opens | escalate to user with logcat instructions |

## Merge contract

Each phase = exactly one PR, one branch, one git tag. PR description mirrors the phase's "Eliminates" column. PR body must include the new APK's sha256 and the public Release URL.

## Definition of done

- The user's Vivo V27 opens Nexus to the Vault screen
- The user pastes their OpenAI key and types one chat message
- The agent loop completes one round-trip (response visible)
- All 270 unit tests still passing
- Five gates green on the merge commit
- A retrospective entry added to `docs/RECOVERY_LOG.md` documenting which hypothesis was confirmed
