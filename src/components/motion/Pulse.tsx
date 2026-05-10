/**
 * Pulse — ambient breathing animation for status indicators, "live"
 * dots, and active-state markers.
 *
 * Loops a gentle opacity + scale wave indefinitely. The default presets
 * (0.6 → 1.0 opacity, 0.96 → 1.04 scale, 1400ms period) feel like a
 * slow heartbeat — alive but not distracting.
 *
 * Reduced-motion: renders the child at its full opacity / scale with
 * no animation at all.
 */

import React, { type PropsWithChildren, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../../hooks/useReduceMotion';

export interface PulseProps {
  readonly periodMs?: number;
  readonly minOpacity?: number;
  readonly maxOpacity?: number;
  readonly minScale?: number;
  readonly maxScale?: number;
  readonly enabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export const Pulse: React.FC<PropsWithChildren<PulseProps>> = ({
  periodMs = 1400,
  minOpacity = 0.6,
  maxOpacity = 1.0,
  minScale = 0.96,
  maxScale = 1.04,
  enabled = true,
  style,
  children,
}) => {
  const reduceMotion = useReduceMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !enabled) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(1, { duration: periodMs, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return (): void => cancelAnimation(phase);
  }, [enabled, periodMs, phase, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion || !enabled) {
      return { opacity: maxOpacity, transform: [{ scale: maxScale }] };
    }
    const opacity = minOpacity + (maxOpacity - minOpacity) * phase.value;
    const scale = minScale + (maxScale - minScale) * phase.value;
    return { opacity, transform: [{ scale }] };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

export default Pulse;
