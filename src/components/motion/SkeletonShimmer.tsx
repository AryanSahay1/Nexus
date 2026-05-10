/**
 * SkeletonShimmer — placeholder block with a sliding highlight.
 *
 * Used by Mail / Calendar / Memory while their initial fetches are in
 * flight. The skill file's §15 (Loading & Skeleton States) is explicit:
 * never show a blank screen and never show a generic spinner where the
 * shape of the data is known. A shimmer block telegraphs "list of N
 * rows is coming" before the data arrives.
 *
 * Implementation: animate a translateX on a horizontal gradient stripe
 * that's clipped to the placeholder's bounds. Loop indefinitely until
 * the consumer stops rendering us.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { COLORS } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

export interface SkeletonShimmerProps {
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const SkeletonShimmer: React.FC<SkeletonShimmerProps> = ({
  width = '100%',
  height = 20,
  radius = 8,
  style,
}) => {
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(offset);
      offset.value = 0;
      return;
    }
    offset.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
    return (): void => cancelAnimation(offset);
  }, [offset, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -200 + offset.value * 600 }],
  }));

  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius: radius },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.background.elevated,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
    backgroundColor: COLORS.background.surface,
    opacity: 0.55,
  },
});

export default SkeletonShimmer;
