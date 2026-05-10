# PRD — React Native Runtime (Maya Patel)

**Owner:** Maya
**Reviewer:** Aaron
**Phase:** 1
**Ticket:** NX-002

## Goal

Defer module-level imports of native libraries that have OEM-specific load behavior, so a single misbehaving native module cannot kill the app before any UI renders.

## Specification

### 1. Lazy-require react-native-app-auth and expo-contacts

In `src/services/bootstrap.ts`:

- Replace `import * as ReactNativeAppAuth from 'react-native-app-auth'` (module-level) with `require('react-native-app-auth')` inside `buildAppAuthBackend()`. This delays the native module init until the user actually taps Connect Google.
- Same for `import * as ExpoContacts from 'expo-contacts'` → lazy-require inside `buildContactsBackend()`.

These two libraries have the largest native init surface area, the most reliance on OEM browser/permission contracts, and are the only optional ones in our boot chain. `expo-secure-store` and `expo-sqlite/next` are core and stay top-level.

### 2. Wrap the bootstrap try/catch

In `app/_layout.tsx`'s useEffect, ensure the outer `try { await bootstrap(); } catch (caught) { ... }` writes the error to a typed state and renders a labeled diagnostic screen rather than letting the exception escape to React's error boundary (which on a fatal native error doesn't catch anything).

### 3. Native crash sentinel

After `bootstrap()` resolves successfully, write a one-line marker to SecureStore: `nexus_last_boot_ok = <iso-timestamp>`. On the next launch, before anything else, read this marker. If the previous launch did not write it, render a "Previous launch crashed" diagnostic screen with a "Reset" button instead of attempting bootstrap again.

This breaks the silent crash loop. The user gets to see *something* on screen.

## Acceptance criteria

- New unit tests confirm lazy-require is wired correctly:
  - The `oauth_backend` step does not call `require('react-native-app-auth')` until invoked
  - The `contacts_backend` step does not call `require('expo-contacts')` until invoked
- `bootstrap.ts` no longer has any module-level import of `react-native-app-auth` or `expo-contacts` (verified by grep)
- The native crash sentinel is read on launch and surfaces a diagnostic screen if the previous launch did not finish bootstrap
