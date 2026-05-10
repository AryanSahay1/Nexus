/**
 * useReduceMotion — subscribes to the OS Reduce Motion preference and
 * exposes it as a stable boolean.
 *
 * Components use this to gate animation: when `true`, durations should
 * collapse to `MOTION.durations.instant`, infinite loops should stop,
 * and entrance animations should land at their final visual state on
 * first paint. The skill file's §16 (Accessibility) makes this
 * non-negotiable.
 *
 * Backed by `AccessibilityInfo`; updates live whenever the user
 * toggles the system setting, no app restart required.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const useReduceMotion = (): boolean => {
  const [reduce, setReduce] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduce(value);
    });
    return (): void => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduce;
};
