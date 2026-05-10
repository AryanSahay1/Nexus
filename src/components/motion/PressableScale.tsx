/**
 * PressableScale — a Pressable that scales down on press with proper
 * spring physics. Single most common micro-interaction in the app.
 *
 * Why not just use the built-in `Pressable` opacity feedback?
 *   - Opacity feedback feels muddy on the dark UI; scale is more
 *     legible.
 *   - The spring rebound ("snappy" preset) reads as tactile —
 *     acknowledges the user's input rather than just dimming.
 *   - The scale is bound to `transform`, which the compositor handles
 *     on the UI thread, so it stays at 60fps even when the JS thread
 *     is busy (typing fast, agent loop running).
 */

import React, { type PropsWithChildren } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SPRINGS } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  readonly scaleTo?: number;
  readonly children?: React.ReactNode;
}

export const PressableScale: React.FC<PropsWithChildren<PressableScaleProps>> = ({
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}) => {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: GestureResponderEvent): void => {
    if (!reduceMotion) {
      scale.value = withSpring(scaleTo, SPRINGS.snappy);
    }
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent): void => {
    if (!reduceMotion) {
      scale.value = withSpring(1, SPRINGS.snappy);
    } else {
      scale.value = 1;
    }
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[StyleSheet.flatten(typeof style === 'function' ? undefined : style), animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

export default PressableScale;
