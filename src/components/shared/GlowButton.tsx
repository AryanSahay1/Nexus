/**
 * GlowButton — primary, danger, and ghost variants. Haptic feedback,
 * loading state, and a Reanimated press scale.
 *
 * The underlying touch target is `Pressable` so disabled state is
 * accessible. `accessibilityLabel` is required for icon-only buttons.
 */

import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { THEME } from '../../theme';

export type GlowButtonVariant = 'primary' | 'danger' | 'ghost';

export interface GlowButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: GlowButtonVariant;
  readonly icon?: React.ReactNode;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
  readonly hapticsEnabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

const colorsFor = (variant: GlowButtonVariant): { bg: string; text: string; border: string } => {
  switch (variant) {
    case 'primary':
      return {
        bg: THEME.colors.accentFill.cyanStrong,
        text: THEME.colors.accent.cyan,
        border: THEME.colors.border.active,
      };
    case 'danger':
      return {
        bg: THEME.colors.accentFill.coralStrong,
        text: THEME.colors.accent.coral,
        border: THEME.colors.border.danger,
      };
    case 'ghost':
    default:
      return {
        bg: 'transparent',
        text: THEME.colors.text.primary,
        border: THEME.colors.border.default,
      };
  }
};

const GlowButtonImpl: React.FC<GlowButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  hapticsEnabled = true,
  accessibilityLabel,
  style,
  testID,
}) => {
  const scale = useSharedValue(1);
  const colors = colorsFor(variant);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const triggerHaptic = (): void => {
    if (!hapticsEnabled) return;
    const impact =
      variant === 'danger' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light;
    void Haptics.impactAsync(impact);
  };

  const isInactive = disabled || loading;

  return (
    <Animated.View style={[fullWidth && { alignSelf: 'stretch' }, animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isInactive, busy: loading }}
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={isInactive}
        onPressIn={() => {
          scale.value = withSpring(0.97, THEME.animation.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, THEME.animation.spring);
        }}
        onPress={() => {
          triggerHaptic();
          onPress();
        }}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
            opacity: isInactive ? 0.4 : pressed ? 0.85 : 1,
          },
          fullWidth && styles.fullWidth,
        ]}
      >
        <View style={styles.row}>
          {loading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : icon !== undefined && icon !== null ? (
            <View style={styles.iconWrap}>{icon}</View>
          ) : null}
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
  },
  iconWrap: {
    marginRight: 0,
  },
  label: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    letterSpacing: 0.2,
  },
});

export const GlowButton = React.memo(GlowButtonImpl);
GlowButton.displayName = 'GlowButton';

export default GlowButton;
