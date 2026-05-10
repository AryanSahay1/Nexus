/**
 * Side-channel through which the active `useTour` hook hands its
 * render state to the root-level `TourProvider`. Lives in its own
 * non-RN module so `useTour` can import it from a plain Node test
 * environment without dragging the React Native module graph in.
 */

import type { MeasuredRect, TourId, TourStep } from './types';

export interface ActiveTourBinding {
  readonly tourId: TourId;
  readonly step: TourStep;
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly targetRect: MeasuredRect | null;
  readonly onAdvance: () => void;
  readonly onSkip: () => void;
}

interface BindingRegistry {
  setBinding: (binding: ActiveTourBinding | null) => void;
}

const registry: { current: BindingRegistry } = {
  current: { setBinding: () => undefined },
};

/** TourProvider calls this on mount to register the React setter. */
export const __registerBindingTarget = (target: BindingRegistry): void => {
  registry.current = target;
};

/** TourProvider calls this on unmount to disconnect. */
export const __clearBindingTarget = (): void => {
  registry.current = { setBinding: () => undefined };
};

/** useTour calls this on every step change (or to clear). */
export const publishActiveTour = (binding: ActiveTourBinding | null): void => {
  registry.current.setBinding(binding);
};
