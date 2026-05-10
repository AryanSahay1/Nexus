/**
 * TourProvider — root-level wrapper that owns the global tour overlay.
 *
 * Two responsibilities:
 *   1. Provide the `TourPortalContext` so any `useTour()` instance in
 *      the tree can register / unregister itself as the active tour.
 *   2. Render a transparent `<Modal>` that sits above EVERY navigation
 *      surface (including tab bars and other modals). The modal hosts
 *      the `<GuidedTour>` overlay supplied by the active hook.
 *
 * Wiring: app/_layout.tsx wraps its tree in `<TourProvider>`. Screens
 * never have to render the overlay themselves — the provider does it
 * once for the whole app.
 *
 * The active tour's `useTour` instance broadcasts its state through a
 * `setActiveTour` callback we expose via a side-channel ref. This is a
 * deliberate inversion: keeping the visual overlay rendered at the
 * provider layer (rather than per-screen) means we get z-ordering above
 * tab bars for free, and any screen that unmounts mid-tour won't take
 * the overlay with it.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { logEvent } from '../../utils/logger';
import { GuidedTour } from './GuidedTour';
import { TourPortalContext, type TourPortalApi } from './tourPortalContext';
import {
  __clearBindingTarget,
  __registerBindingTarget,
  type ActiveTourBinding,
} from './tourBindingChannel';
import type { TourId } from './types';

interface TourProviderProps {
  readonly children: React.ReactNode;
}

export const TourProvider: React.FC<TourProviderProps> = ({ children }) => {
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [binding, setBinding] = useState<ActiveTourBinding | null>(null);
  const listenersRef = useRef<Set<(s: { tourId: TourId | null }) => void>>(new Set());

  // Wire the side-channel registry once on mount.
  React.useEffect(() => {
    __registerBindingTarget({ setBinding });
    return (): void => {
      __clearBindingTarget();
    };
  }, []);

  const notify = useCallback((tourId: TourId | null): void => {
    for (const listener of Array.from(listenersRef.current)) {
      try {
        listener({ tourId });
      } catch {
        /* swallow — a listener crashing must not block the next one */
      }
    }
  }, []);

  const activate = useCallback(
    (tourId: TourId): void => {
      setActiveTourId(tourId);
      logEvent('tour_portal_activated', { event: tourId });
      notify(tourId);
    },
    [notify],
  );

  const deactivate = useCallback((): void => {
    setActiveTourId(null);
    setBinding(null);
    notify(null);
  }, [notify]);

  const subscribe = useCallback(
    (listener: (s: { tourId: TourId | null }) => void): (() => void) => {
      listenersRef.current.add(listener);
      return (): void => {
        listenersRef.current.delete(listener);
      };
    },
    [],
  );

  const portalApi: TourPortalApi = useMemo(
    () => ({
      isActive: activeTourId !== null,
      activeTourId,
      activate,
      deactivate,
      subscribe,
    }),
    [activeTourId, activate, deactivate, subscribe],
  );

  return (
    <TourPortalContext.Provider value={portalApi}>
      {children}
      <Modal
        visible={binding !== null}
        transparent
        animationType="fade"
        onRequestClose={() => binding?.onSkip()}
        statusBarTranslucent
      >
        {binding !== null ? (
          <View style={StyleSheet.absoluteFill}>
            <GuidedTour
              step={binding.step}
              stepIndex={binding.stepIndex}
              stepCount={binding.stepCount}
              targetRect={binding.targetRect}
              onAdvance={binding.onAdvance}
              onSkip={binding.onSkip}
            />
          </View>
        ) : null}
      </Modal>
    </TourPortalContext.Provider>
  );
};
