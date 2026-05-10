/**
 * useConfirmation — Promise-resolver glue between agentLoop and the UI.
 *
 * The agent loop calls `awaitConfirmation()` and waits. When the user
 * taps Confirm or Cancel on the ConfirmationSheet, the corresponding
 * resolver is invoked and the loop resumes with the user's decision.
 *
 * The resolver lives outside React state so a stale render never causes
 * the loop to hang. Tests can drive the gate via the `__test__` exports.
 */

import { useCallback, useRef } from 'react';

export interface ConfirmationDecision {
  readonly confirmed: boolean;
}

type Resolver = (decision: ConfirmationDecision) => void;

interface ConfirmationApi {
  /** Returned to agentLoop. Resolves on the next confirm/cancel. */
  readonly awaitConfirmation: () => Promise<ConfirmationDecision>;
  /** Wired to the Confirm button. */
  readonly confirm: () => void;
  /** Wired to the Cancel button (and backdrop tap). */
  readonly cancel: () => void;
}

/**
 * Module-level singleton. The agent loop is also a module-level
 * singleton (it has no React lifecycle), so the gate they share must
 * also be module-scoped — using `useRef` would not survive across
 * different consumer components rendering the same logical sheet.
 */
let pendingResolver: Resolver | null = null;

export const awaitConfirmationGlobal = (): Promise<ConfirmationDecision> => {
  // If somehow there's already a pending one, reject the previous as
  // cancelled before installing a new one. This should never happen in
  // production because chatStore.pendingAction guards against it, but
  // it keeps the contract honest.
  if (pendingResolver !== null) {
    pendingResolver({ confirmed: false });
    pendingResolver = null;
  }
  return new Promise<ConfirmationDecision>((resolve) => {
    pendingResolver = resolve;
  });
};

export const confirmGlobal = (): void => {
  if (pendingResolver === null) return;
  const r = pendingResolver;
  pendingResolver = null;
  r({ confirmed: true });
};

export const cancelGlobal = (): void => {
  if (pendingResolver === null) return;
  const r = pendingResolver;
  pendingResolver = null;
  r({ confirmed: false });
};

/** Test-only escape hatch. */
export const __resetConfirmationForTests = (): void => {
  pendingResolver = null;
};

/** React hook surface used by ConfirmationSheet. */
export const useConfirmation = (): ConfirmationApi => {
  const stable = useRef<ConfirmationApi>({
    awaitConfirmation: awaitConfirmationGlobal,
    confirm: confirmGlobal,
    cancel: cancelGlobal,
  });
  // confirm + cancel are stable callbacks that close over the module
  // resolver, so consumers can pass them straight to onPress without
  // useCallback themselves.
  return stable.current;
};

/** For tests asserting the hook contract directly. */
export const __useStableApiForTests = (): ConfirmationApi => ({
  awaitConfirmation: awaitConfirmationGlobal,
  confirm: useCallback(confirmGlobal, []),
  cancel: useCallback(cancelGlobal, []),
});
