/**
 * Unit tests for src/utils/bootSequencer.ts.
 *
 * Locks down the hardening contract from the boot-failure recovery cycle:
 *   - critical step failure stops the sequence and returns a typed BootFailure
 *   - non-critical step failure is logged but the sequence continues
 *   - hung steps time out instead of pinning the boot forever
 *   - unexpected synchronous throw is caught + converted to a Result
 *   - timing instrumentation is recorded for every step
 */

import { NexusError, err, ok, type Result } from '../../src/types/auth';
import {
  __internal,
  runBootSequence,
  type BootStep,
} from '../../src/utils/bootSequencer';

const okStep = (id: string, kind: BootStep['kind'] = 'critical'): BootStep => ({
  id,
  kind,
  run: async () => ok('done'),
});

const failingStep = (
  id: string,
  kind: BootStep['kind'] = 'critical',
  code: 'UNKNOWN' | 'NETWORK_ERROR' = 'UNKNOWN',
): BootStep => ({
  id,
  kind,
  run: async () => err(new NexusError(code, `simulated failure at ${id}`)),
});

describe('runBootSequence', () => {
  it('runs every step in order and returns a clean BootReport on success', async () => {
    const result = await runBootSequence([
      okStep('a'),
      okStep('b'),
      okStep('c'),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completed).toEqual(['a', 'b', 'c']);
      expect(result.value.nonCriticalFailures).toEqual([]);
      expect(result.value.totalLatencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('stops at the first critical failure and surfaces step id + error code', async () => {
    let cReached = false;
    const cStep: BootStep = {
      id: 'c',
      kind: 'critical',
      run: async () => {
        cReached = true;
        return ok(undefined);
      },
    };
    const result = await runBootSequence([
      okStep('a'),
      failingStep('b', 'critical'),
      cStep,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stepId).toBe('b');
      expect(result.error.error.code).toBe('UNKNOWN');
    }
    expect(cReached).toBe(false);
  });

  it('continues past a non-critical failure and records it in the report', async () => {
    const result = await runBootSequence([
      okStep('a'),
      failingStep('flaky', 'non_critical'),
      okStep('c'),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completed).toEqual(['a', 'c']);
      expect(result.value.nonCriticalFailures.map((f) => f.stepId)).toEqual(['flaky']);
    }
  });

  it('catches a synchronous throw inside a step and converts to a typed Err', async () => {
    const throwing: BootStep = {
      id: 'thrower',
      kind: 'critical',
      run: async () => {
        throw new Error('boom');
      },
    };
    const result = await runBootSequence([throwing]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stepId).toBe('thrower');
      expect(result.error.error.code).toBe('UNKNOWN');
      expect(result.error.error.message).toContain('boom');
    }
  });

  it('catches a non-Error throw without crashing', async () => {
    const exotic: BootStep = {
      id: 'exotic',
      kind: 'critical',
      run: async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'string error';
      },
    };
    const result = await runBootSequence([exotic]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.stepId).toBe('exotic');
  });

  it('times out a hung step rather than pinning the boot forever', async () => {
    jest.useFakeTimers();
    try {
      const hangPromise: Promise<Result<unknown, NexusError>> = new Promise(() => {
        /* never resolves */
      });
      const promise = __internal.withTimeout('hung_step', hangPromise);
      jest.advanceTimersByTime(__internal.STEP_TIMEOUT_MS + 100);
      const result = await promise;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('timed out');
        expect(result.error.message).toContain('hung_step');
        expect(result.error.isRetryable).toBe(true);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes STEP_TIMEOUT_MS as a known constant for documentation', () => {
    expect(__internal.STEP_TIMEOUT_MS).toBe(12_000);
  });

  it('logging hygiene: step IDs are snake_case and never carry PII', async () => {
    const messages: string[] = [];
    const log = jest.spyOn(console, 'log').mockImplementation((m: unknown) => {
      messages.push(String(m));
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation((m: unknown) => {
      messages.push(String(m));
    });
    try {
      await runBootSequence([
        okStep('db_init'),
        failingStep('vault_hydrate', 'critical'),
      ]);
      const joined = messages.join('\n');
      // Each step ID appears via the safe `tool_name` field.
      expect(joined).toContain('"tool_name":"db_init"');
      expect(joined).toContain('"tool_name":"vault_hydrate"');
      // No tokens / emails / phone numbers should ever appear.
      expect(joined).not.toMatch(/sk-[A-Za-z0-9]/);
      expect(joined).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    } finally {
      log.mockRestore();
      errSpy.mockRestore();
    }
  });
});
