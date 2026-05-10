/**
 * ClawPanel — the signature industrial panel.
 *
 * Renders a rounded surface with one-pixel cyan-tinted borders and four
 * tiny chamfered "claw" corners (10x10 squares rotated 45deg, painted
 * the parent background color, sized to bleed into each corner producing
 * a cut-corner illusion without clip-path).
 *
 * Optional `glowing` prop pulses the border opacity. Optional `tone`
 * recolors the border for warning / danger / memory contexts.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { THEME } from '../../theme';

export type PanelTone = 'default' | 'warning' | 'danger' | 'memory';

export interface ClawPanelProps {
  readonly children?: React.ReactNode;
  readonly tone?: PanelTone;
  readonly glowing?: boolean;
  readonly elevated?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

const borderColorFor = (tone: PanelTone): string => {
  switch (tone) {
    case 'warning':
      return THEME.colors.border.warning;
    case 'danger':
      return THEME.colors.border.danger;
    case 'memory':
      return THEME.colors.border.memory;
    case 'default':
    default:
      return THEME.colors.border.default;
  }
};

const ClawPanelImpl: React.FC<ClawPanelProps> = ({
  children,
  tone = 'default',
  glowing = false,
  elevated = false,
  style,
  contentStyle,
  testID,
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!glowing) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(THEME.animation.glowMaxOpacity, {
          duration: THEME.animation.glowDurationMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(THEME.animation.glowMinOpacity, {
          duration: THEME.animation.glowDurationMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [glowing, opacity]);

  const borderStyle = useAnimatedStyle(() => ({
    opacity: glowing ? opacity.value : 1,
  }));

  const bg = elevated ? THEME.colors.background.elevated : THEME.colors.background.surface;
  const cornerStyle: ViewStyle = {
    width: THEME.claw.size,
    height: THEME.claw.size,
    backgroundColor: THEME.colors.background.primary,
    transform: [{ rotate: `${THEME.claw.rotationDeg}deg` }],
    position: 'absolute',
  };

  return (
    <View
      testID={testID}
      style={[
        styles.outer,
        { backgroundColor: bg, borderColor: borderColorFor(tone) },
        style,
      ]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.borderOverlay, { borderColor: borderColorFor(tone) }, borderStyle]} />
      <View style={[styles.content, contentStyle]}>{children}</View>
      <View style={[cornerStyle, { top: -THEME.claw.size / 2, left: -THEME.claw.size / 2 }]} />
      <View style={[cornerStyle, { top: -THEME.claw.size / 2, right: -THEME.claw.size / 2 }]} />
      <View style={[cornerStyle, { bottom: -THEME.claw.size / 2, left: -THEME.claw.size / 2 }]} />
      <View style={[cornerStyle, { bottom: -THEME.claw.size / 2, right: -THEME.claw.size / 2 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    overflow: 'visible',
    position: 'relative',
  },
  borderOverlay: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
  },
  content: {
    padding: THEME.spacing.lg,
  },
});

export const ClawPanel = React.memo(ClawPanelImpl);
ClawPanel.displayName = 'ClawPanel';

export default ClawPanel;
