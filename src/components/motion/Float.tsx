/**
 * Float — gentle continuous vertical bob used for hero glyphs and
 * empty-state illustrations.
 *
 * The skill file's §10 calls this out as a cheap way to give a flat
 * glyph some "life" without committing to a 3D engine. The amplitude
 * stays small (4 dp by default) so it reads as ambient motion, not as
 * something demanding attention.
 *
 * Reduced-motion users see a static glyph at the centred Y position.
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

export interface FloatProps {
  readonly amplitudeDp?: number;
  readonly periodMs?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

export const Float: React.FC<PropsWithChildren<FloatProps>> = ({
  amplitudeDp = 4,
  periodMs = 2400,
  style,
  children,
}) => {
  const reduceMotion = useReduceMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
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
  }, [periodMs, phase, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: phase.value * amplitudeDp - amplitudeDp / 2 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

export default Float;
