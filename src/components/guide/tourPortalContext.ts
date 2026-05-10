/**
 * Singleton portal context for the guided tour overlay.
 *
 * Only one tour can be on screen at a time. The TourProvider sits at the
 * root of the app and registers itself as the global portal target. Any
 * `useTour()` instance reads `useTourPortal()` to ask the provider to
 * activate / deactivate the modal overlay.
 *
 * We deliberately keep this state outside Zustand so it is not
 * persisted, not serialised, and not visible to consumers that don't
 * need it.
 */

import { createContext, useContext } from 'react';

import type { TourId } from './types';

export interface TourPortalApi {
  readonly isActive: boolean;
  /** Currently active tour id, if any. Used by the overlay to query state. */
  readonly activeTourId: TourId | null;
  readonly activate: (tourId: TourId) => void;
  readonly deactivate: () => void;
  /**
   * Subscribe — used by the TourProvider to learn which `useTour`
   * instance is currently driving the overlay.
   */
  readonly subscribe: (
    listener: (state: { tourId: TourId | null }) => void,
  ) => () => void;
}

const noop = (): void => undefined;

/**
 * Default value used when the provider is missing. We never throw — a
 * screen that calls `useTour()` outside the provider gets a no-op
 * portal and the tour silently never renders. (LAW 3: never crash on
 * a state-machine bug; log + recover.)
 */
export const TourPortalContext = createContext<TourPortalApi>({
  isActive: false,
  activeTourId: null,
  activate: noop,
  deactivate: noop,
  subscribe: () => noop,
});

export const useTourPortal = (): TourPortalApi => useContext(TourPortalContext);
