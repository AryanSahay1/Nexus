/**
 * useTour — the hook every screen uses to drive a guided tour.
 *
 *   const tour = useTour('chat_first_message', steps);
 *   useEffect(() => { void tour.startTour(); }, []);  // gated by completion
 *
 * Surface (kept stable so screens never have to learn the internals):
 *   - `startTour()`            asks the registry to begin if we haven't
 *                               persisted completion. No-op otherwise.
 *   - `isTourActive`           boolean for conditional rendering.
 *   - `currentStep` / `currentStepIndex`  current step + 0-indexed pos.
 *   - `advanceStep()`          go to the next step, or finish if last.
 *   - `skipTour()`             dismiss the entire tour and persist
 *                               completion (so it never auto-starts again).
 *   - `currentRect`            measured rect for the current step's
 *                               targetRef, in screen coordinates.
 *
 * Persistence: completion is written to `user_preferences` via
 * `preferencesStore.set(tour_completed_<id>, '1', 'behavior')`. This is
 * the same persistence the rest of the agent's memory uses, so a
 * "restart guided tours" affordance can wipe completion en-masse.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { logEvent, logError } from '../../utils/logger';
import { getPreferencesStore } from '../../store/preferencesStore';
import { publishActiveTour } from './tourBindingChannel';
import { useTourPortal } from './tourPortalContext';
import { completionKey, type MeasuredRect, type TourId, type TourStep } from './types';

export interface UseTourApi {
  readonly tourId: TourId;
  readonly steps: readonly TourStep[];
  readonly isTourActive: boolean;
  readonly currentStepIndex: number;
  readonly currentStep: TourStep | null;
  readonly currentRect: MeasuredRect | null;
  readonly startTour: () => Promise<void>;
  readonly advanceStep: () => void;
  readonly skipTour: () => Promise<void>;
}

interface MeasureRefHandle {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

/**
 * Read the completion flag from the preferences snapshot. Snapshot is
 * a `Record<string, string>`, which makes the lookup O(1) and avoids
 * the snapshot iterating its `entries` array on every render.
 */
const isAlreadyCompleted = (snapshot: Readonly<Record<string, string>>, id: TourId): boolean =>
  snapshot[completionKey(id)] === '1';

/**
 * Best-effort measure of a ref. Returns null if the underlying view
 * isn't laid out yet. We deliberately don't throw — see LAW 3: a
 * tour-overlay bug must never crash the host screen.
 */
const measureRef = async (
  ref: TourStep['targetRef'],
): Promise<MeasuredRect | null> => {
  const node = ref.current as MeasureRefHandle | null;
  if (node === null || typeof node.measureInWindow !== 'function') return null;
  return new Promise<MeasuredRect | null>((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => {
        if (
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height)
        ) {
          resolve({ x, y, width, height });
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
};

export const useTour = (
  tourId: TourId,
  steps: readonly TourStep[],
): UseTourApi => {
  const portal = useTourPortal();
  const snapshot = useStore(getPreferencesStore(), (s) => s.snapshot);
  const setPreference = useStore(getPreferencesStore(), (s) => s.set);

  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentRect, setCurrentRect] = useState<MeasuredRect | null>(null);
  const activeRef = useRef(false);

  const persistCompletion = useCallback(async (): Promise<void> => {
    const result = await setPreference(completionKey(tourId), '1', 'behavior');
    if (!result.ok) {
      logError('tour_completion_persist_failed', { error_code: result.error.code });
    }
  }, [setPreference, tourId]);

  const finish = useCallback(async (): Promise<void> => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setIsTourActive(false);
    setCurrentRect(null);
    portal.deactivate();
    logEvent('tour_completed', { event: tourId });
    await persistCompletion();
  }, [persistCompletion, portal, tourId]);

  const measureCurrent = useCallback(
    async (index: number): Promise<void> => {
      const step = steps[index];
      if (step === undefined) {
        setCurrentRect(null);
        return;
      }
      const rect = await measureRef(step.targetRef);
      setCurrentRect(rect);
    },
    [steps],
  );

  const startTour = useCallback(async (): Promise<void> => {
    if (activeRef.current) return;
    if (steps.length === 0) return;
    if (isAlreadyCompleted(snapshot, tourId)) return;
    if (portal.isActive) return; // another tour is on screen — defer
    activeRef.current = true;
    setCurrentStepIndex(0);
    setIsTourActive(true);
    portal.activate(tourId);
    logEvent('tour_started', { event: tourId });
    await measureCurrent(0);
  }, [measureCurrent, portal, snapshot, steps.length, tourId]);

  const advanceStep = useCallback((): void => {
    if (!activeRef.current) return;
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= steps.length) {
        // Fire-and-forget — finish handles persistence + portal state.
        void finish();
        return prev;
      }
      void measureCurrent(next);
      logEvent('tour_step_advanced', { event: tourId, iteration: next });
      return next;
    });
  }, [finish, measureCurrent, steps.length, tourId]);

  const skipTour = useCallback(async (): Promise<void> => {
    if (!activeRef.current) return;
    logEvent('tour_skipped', { event: tourId, iteration: currentStepIndex });
    await finish();
  }, [currentStepIndex, finish, tourId]);

  // Re-measure on every step change in case the layout shifted.
  useEffect(() => {
    if (!activeRef.current) return;
    void measureCurrent(currentStepIndex);
  }, [currentStepIndex, measureCurrent]);

  // Publish the current binding to the TourProvider so it can render
  // the overlay above the navigator. Clear it whenever the tour ends.
  useEffect(() => {
    if (!isTourActive) {
      publishActiveTour(null);
      return;
    }
    const step = steps[currentStepIndex];
    if (step === undefined) return;
    publishActiveTour({
      tourId,
      step,
      stepIndex: currentStepIndex,
      stepCount: steps.length,
      targetRect: currentRect,
      onAdvance: advanceStep,
      onSkip: () => {
        void skipTour();
      },
    });
  }, [
    advanceStep,
    currentRect,
    currentStepIndex,
    isTourActive,
    skipTour,
    steps,
    tourId,
  ]);

  // If the host screen unmounts while a tour is active, deactivate
  // the portal so a stale overlay doesn't linger over the next screen.
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        activeRef.current = false;
        portal.deactivate();
        publishActiveTour(null);
      }
    };
  }, [portal]);

  return {
    tourId,
    steps,
    isTourActive,
    currentStepIndex,
    currentStep: steps[currentStepIndex] ?? null,
    currentRect,
    startTour,
    advanceStep,
    skipTour,
  };
};

/** Test-only — exported for unit coverage of the measurement path. */
export const __internal = { measureRef, isAlreadyCompleted };
