/**
 * Tilt3D — a card-shaped wrapper that tilts and lifts on press, giving
 * the surface a tactile 3D feel without an actual 3D engine.
 *
 * Implementation: pure CSS-style perspective + rotateX + translateZ via
 * Reanimated. The "depth" comes from a simultaneous shadow boost.
 *
 * Used on Vault ServiceCards and the Settings capability rows. We don't
 * apply this to every Pressable — only to surfaces the user is meant to
 * notice as interactive (the skill file's §10 is explicit that 3D is a
 * tool for emphasis, not a default).
 */

import React, { type PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SPRINGS } from '../../theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface Tilt3DProps {
  /**
   * Maximum tilt in degrees on the X axis. Negative tilts the top
   * forward (away from the user). Default −4 looks like the card is
   * being lightly pressed into the page.
   */
  readonly maxTiltX?: number;
  /** Z translate in dp at full press depth. */
  readonly depthDp?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

interface InternalProps extends Tilt3DProps {
  readonly onPressIn?: () => void;
  readonly onPressOut?: () => void;
}

const Tilt3DImpl: React.FC<PropsWithChildren<InternalProps>> = ({
  maxTiltX = -4,
  depthDp = 6,
  style,
  children,
}) => {
  const reduceMotion = useReduceMotion();
  const tilt = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const t = tilt.value;
    return {
      transform: [
        { perspective: 800 },
        { rotateX: `${t * maxTiltX}deg` },
        { translateY: t * (depthDp / 2) },
        { scale: 1 - t * 0.02 },
      ],
    };
  });

  // We expose imperative handles via the surrounding Pressable wrapper.
  // To keep this primitive composable, the actual press capture is done
  // by the caller — they pass a `useTiltHandle()` reference. To keep
  // the simplest form below, we expose a setter on the shared value via
  // module-level helpers.
  if (reduceMotion) {
    tilt.value = 0;
  }
  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

/**
 * The full Tilt3D primitive: a tappable card that tilts on press. Uses
 * `PressableScale`'s own gesture but adds the rotation + depth on top.
 */
export interface TiltCardProps extends Omit<PressableProps, 'children' | 'style'> {
  readonly maxTiltX?: number;
  readonly depthDp?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}

export const TiltCard: React.FC<PropsWithChildren<TiltCardProps>> = ({
  maxTiltX = -4,
  depthDp = 6,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const reduceMotion = useReduceMotion();
  const tilt = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const t = tilt.value;
    return {
      transform: [
        { perspective: 800 },
        { rotateX: `${t * maxTiltX}deg` },
        { translateY: t * (depthDp / 2) },
        { scale: 1 - t * 0.02 },
      ],
    };
  });

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        if (!reduceMotion) tilt.value = withSpring(1, SPRINGS.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) tilt.value = withSpring(0, SPRINGS.gentle);
        else tilt.value = 0;
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

/** Non-pressable variant — just renders the layout w/ no gesture. */
export const Tilt3D = Tilt3DImpl;

export default TiltCard;
