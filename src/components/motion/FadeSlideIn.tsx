/**
 * FadeSlideIn — wraps any child in an opacity + translateY entrance
 * animation. Used for hero text, stat tiles, and (with `index` prop)
 * staggered list entrances.
 *
 * The animation runs once on mount and lands at the final state. With
 * reduce-motion enabled, the wrapper renders the child at its final
 * state immediately — no transition, no missed frame.
 */

import React, { type PropsWithChildren, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { DURATIONS, EASINGS, staggerDelayMs } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

export interface FadeSlideInProps {
  /** Stagger index — 0 means no delay; positive ints offset the start. */
  readonly index?: number;
  /** Animation duration in ms. Defaults to `MOTION.durations.moderate`. */
  readonly durationMs?: number;
  /** Translation offset in dp. Defaults to 12 (subtle, not melodramatic). */
  readonly fromY?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

export const FadeSlideIn: React.FC<PropsWithChildren<FadeSlideInProps>> = ({
  index = 0,
  durationMs = DURATIONS.moderate,
  fromY = 12,
  style,
  children,
}) => {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : fromY);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    const delay = staggerDelayMs(index);
    const config = { duration: durationMs, easing: EASINGS.out };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateY.value = withDelay(delay, withTiming(0, config));
  }, [durationMs, fromY, index, opacity, reduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

export default FadeSlideIn;
