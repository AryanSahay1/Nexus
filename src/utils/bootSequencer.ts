/**
 * BootSequencer — runs an ordered list of named initialization steps with
 * defense-in-depth around every individual step.
 *
 * Per Dr. Elena Vasquez's hardening protocol: every future boot failure
 * must surface the *specific* step that failed and the *actual* error
 * code, not a generic "Boot failed" message. This module makes that
 * trivially achievable from the root layout.
 *
 * Each step is either:
 *   - critical    : a failure stops the boot sequence and surfaces the
 *                   step name + error to the UI.
 *   - non-critical: a failure is logged and the sequence continues.
 *                   Used for things like "load chat history" where a
 *                   missing prior conversation should not prevent the
 *                   user from chatting.
 *
 * Every step is timed in milliseconds and the timing is emitted through
 * the existing privacy-safe logger (LAW 2 — only field names that are
 * already on the safe-field allowlist).
 */

import { NexusError, type Result, err, ok } from '../types/auth';
import { logError, logEvent } from './logger';

export type BootStepKind = 'critical' | 'non_critical';

export interface BootStep {
  /**
   * Stable snake_case identifier shown in the boot-failed UI. Must be
   * stable across releases so support staff can refer to it.
   */
  readonly id: string;
  readonly kind: BootStepKind;
  readonly run: () => Promise<Result<unknown, NexusError>>;
}

export interface BootFailure {
  readonly stepId: string;
  readonly error: NexusError;
}

export interface BootReport {
  readonly completed: readonly string[];
  readonly nonCriticalFailures: readonly BootFailure[];
  readonly totalLatencyMs: number;
}

/**
 * Wrap any step in a timeout so a hung native call cannot pin the boot
 * sequence forever. 12 seconds is generous — the slowest step on a real
 * device (cold-start SQLite open + migration) finishes under 1 second.
 */
const STEP_TIMEOUT_MS = 12_000;

const withTimeout = <T>(
  stepId: string,
  promise: Promise<Result<T, NexusError>>,
): Promise<Result<T, NexusError>> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<Result<T, NexusError>>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve(
        err(
          new NexusError(
            'NETWORK_ERROR',
            `boot step '${stepId}' timed out after ${STEP_TIMEOUT_MS}ms.`,
            { isRetryable: true },
          ),
        ),
      );
    }, STEP_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  });
};

/**
 * Run the steps in order. Returns:
 *   - Ok(BootReport) when every critical step succeeded.
 *   - Err(BootFailure) when a critical step failed; the failing step's
 *     id and error are surfaced for the UI to render.
 */
export const runBootSequence = async (
  steps: readonly BootStep[],
): Promise<Result<BootReport, BootFailure>> => {
  const completed: string[] = [];
  const nonCriticalFailures: BootFailure[] = [];
  const start = Date.now();

  for (const step of steps) {
    const stepStart = Date.now();
    let result: Result<unknown, NexusError>;
    try {
      result = await withTimeout(step.id, step.run());
    } catch (caught) {
      // Defensive: even though every Nexus service returns a Result, an
      // unexpected throw from native code or a downstream library must
      // not crash the boot sequence. LAW 3.
      const e =
        caught instanceof NexusError
          ? caught
          : new NexusError(
              'UNKNOWN',
              caught instanceof Error ? caught.message : 'unknown boot step error',
              { isRetryable: false, cause: caught },
            );
      result = err(e);
    }
    const latency = Date.now() - stepStart;

    if (result.ok) {
      completed.push(step.id);
      logEvent('boot_step_ok', { tool_name: step.id, latency_ms: latency });
      continue;
    }

    if (step.kind === 'non_critical') {
      logError('boot_step_failed_noncritical', {
        tool_name: step.id,
        latency_ms: latency,
        error_code: result.error.code,
      });
      nonCriticalFailures.push({ stepId: step.id, error: result.error });
      continue;
    }

    logError('boot_step_failed_critical', {
      tool_name: step.id,
      latency_ms: latency,
      error_code: result.error.code,
    });
    return err({ stepId: step.id, error: result.error });
  }

  return ok({
    completed,
    nonCriticalFailures,
    totalLatencyMs: Date.now() - start,
  });
};

export const __internal = { STEP_TIMEOUT_MS, withTimeout };
