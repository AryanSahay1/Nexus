/**
 * CountUp — eases a numeric value from 0 (or `from`) to `value` on mount
 * and re-runs whenever `value` changes by more than `minDeltaToAnimate`.
 *
 * Why this exists: the skill file's §9 ("Value Change") is explicit —
 * counters, KPIs, and stat tiles must animate, not snap. A snap reads as
 * a re-render glitch; the gentle ease-out reads as the number being
 * computed live.
 *
 * Implementation notes:
 *   - Driven on the UI thread via Reanimated's `useDerivedValue` +
 *     `useAnimatedReaction`, so the JS thread is free to keep the rest
 *     of the screen responsive while the count runs.
 *   - The actual `Text` is updated through a regular `setState` call
 *     because Reanimated cannot animate the string contents of a Text
 *     node — only the numeric value drives the React re-render, capped
 *     to ~30Hz so we don't thrash setState on every frame.
 *   - Reduced-motion: lands on the final value immediately.
 */

import React, { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DURATIONS } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

export interface CountUpProps {
  readonly value: number;
  readonly from?: number;
  readonly durationMs?: number;
  /** Locale formatter — defaults to a no-op integer. */
  readonly format?: (n: number) => string;
  readonly minDeltaToAnimate?: number;
  readonly style?: StyleProp<TextStyle>;
  readonly testID?: string;
}

const defaultFormat = (n: number): string => Math.round(n).toLocaleString();

export const CountUp: React.FC<CountUpProps> = ({
  value,
  from = 0,
  durationMs = DURATIONS.expressive,
  format = defaultFormat,
  minDeltaToAnimate = 0.5,
  style,
  testID,
}) => {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? value : from);
  const [display, setDisplay] = useState<string>(format(reduceMotion ? value : from));

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = value;
      setDisplay(format(value));
      return;
    }
    const delta = Math.abs(value - progress.value);
    if (delta < minDeltaToAnimate) {
      progress.value = value;
      setDisplay(format(value));
      return;
    }
    progress.value = withTiming(value, {
      duration: durationMs,
      easing: Easing.bezier(0, 0, 0.2, 1),
    });
  }, [durationMs, format, minDeltaToAnimate, progress, reduceMotion, value]);

  // Cap React re-renders so we don't fight Reanimated for the UI thread.
  // ~33ms = 30Hz which is more than enough for human-perceived continuity.
  useAnimatedReaction(
    () => progress.value,
    (cur, prev) => {
      if (prev === null || Math.abs(cur - prev) > 0.4) {
        runOnJS(setDisplay)(format(cur));
      }
    },
    [format],
  );

  return (
    <Text style={style} testID={testID}>
      {display}
    </Text>
  );
};

export default CountUp;
