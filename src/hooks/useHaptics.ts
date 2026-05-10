/**
 * useHaptics — convenience wrapper that gates expo-haptics on the
 * settingsStore `hapticsEnabled` toggle.
 */

import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useStore } from 'zustand';

import { getSettingsStore } from '../store/settingsStore';

interface HapticsApi {
  readonly light: () => void;
  readonly medium: () => void;
  readonly heavy: () => void;
  readonly success: () => void;
  readonly warning: () => void;
  readonly error: () => void;
}

const fire = (impact: () => Promise<void> | void): void => {
  void impact();
};

export const useHaptics = (): HapticsApi => {
  const enabled = useStore(getSettingsStore(), (s) => s.hapticsEnabled);

  const light = useCallback(() => {
    if (!enabled) return;
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, [enabled]);
  const medium = useCallback(() => {
    if (!enabled) return;
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, [enabled]);
  const heavy = useCallback(() => {
    if (!enabled) return;
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  }, [enabled]);
  const success = useCallback(() => {
    if (!enabled) return;
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }, [enabled]);
  const warning = useCallback(() => {
    if (!enabled) return;
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }, [enabled]);
  const error = useCallback(() => {
    if (!enabled) return;
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }, [enabled]);

  return { light, medium, heavy, success, warning, error };
};
