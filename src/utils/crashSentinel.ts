/**
 * Crash sentinel — survives across launches inside SecureStore.
 *
 * Two timestamps:
 *   - `nexus_last_boot_attempt`  (written before bootstrap starts)
 *   - `nexus_last_boot_ok`       (written after bootstrap returns ok)
 *
 * If on launch we read `attempt > ok` (or `ok` is unset while `attempt`
 * is set), the previous launch crashed mid-bootstrap. The root layout
 * uses this signal to skip the failing bootstrap and route the user to
 * the diagnostic screen so they see *something* instead of a silent
 * close-on-open loop.
 *
 * The two keys live alongside the credential store on purpose: SecureStore
 * is the only persistent side-effect we trust to survive a hard native
 * crash. We do NOT use SQLite for this because the database init itself
 * is one of the steps that can fail.
 */

import * as SecureStore from 'expo-secure-store';

import { NexusError, type Result, err, ok } from '../types/auth';

const KEY_ATTEMPT = 'nexus_last_boot_attempt' as const;
const KEY_OK = 'nexus_last_boot_ok' as const;

export interface SentinelReading {
  /** ISO timestamp of the last attempt, or null if first ever launch. */
  readonly attemptIso: string | null;
  /** ISO timestamp of the last successful bootstrap, or null. */
  readonly okIso: string | null;
  /**
   * True when the previous launch attempted bootstrap but never finished —
   * implying a native crash mid-init. Diagnostic UI should appear.
   */
  readonly previousLaunchCrashed: boolean;
}

const safeRead = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // SecureStore unreachable on this device. Treat as null — the diag
    // screen will surface the underlying issue via its probes.
    return null;
  }
};

const safeWrite = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // Suppressed: a sentinel write failure is not fatal — the boot can
    // still proceed; the next launch may show a false-positive
    // "previous launch crashed" diagnostic, which is harmless.
  }
};

/** Read the sentinel BEFORE bootstrap. Always succeeds (returns nulls on read failure). */
export const readSentinel = async (): Promise<SentinelReading> => {
  const [attemptIso, okIso] = await Promise.all([safeRead(KEY_ATTEMPT), safeRead(KEY_OK)]);

  // No attempt ever recorded → first launch, no crash signal.
  if (attemptIso === null) {
    return { attemptIso: null, okIso, previousLaunchCrashed: false };
  }

  // Attempt timestamp present but no ok timestamp → previous launch
  // attempted bootstrap and never wrote the success marker.
  if (okIso === null) {
    return { attemptIso, okIso, previousLaunchCrashed: true };
  }

  // Both present — compare. A crashed launch leaves attempt strictly
  // newer than ok.
  const aMs = Date.parse(attemptIso);
  const oMs = Date.parse(okIso);
  if (Number.isNaN(aMs) || Number.isNaN(oMs)) {
    return { attemptIso, okIso, previousLaunchCrashed: true };
  }
  return { attemptIso, okIso, previousLaunchCrashed: aMs > oMs };
};

/** Mark "boot started" — call before bootstrap(). */
export const markAttempt = async (): Promise<void> => {
  await safeWrite(KEY_ATTEMPT, new Date().toISOString());
};

/** Mark "boot completed ok" — call after bootstrap() returns ok. */
export const markOk = async (): Promise<void> => {
  await safeWrite(KEY_OK, new Date().toISOString());
};

/** Test-only / Reset button helper. Clears both sentinels. */
export const clearSentinel = async (): Promise<Result<void, NexusError>> => {
  try {
    await SecureStore.deleteItemAsync(KEY_ATTEMPT);
    await SecureStore.deleteItemAsync(KEY_OK);
    return ok(undefined);
  } catch (cause) {
    return err(
      new NexusError('UNKNOWN', 'failed to clear crash sentinel.', {
        isRetryable: false,
        cause,
      }),
    );
  }
};

export const __internal = { KEY_ATTEMPT, KEY_OK };
