/**
 * Avatar — circular initial-or-image avatar.
 *
 * Falls back to the first character of the supplied label if no image
 * URI is provided. Background defaults to the cyan-tinted accent fill
 * so the contrast on the dark theme remains legible.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { THEME } from '../../theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  readonly label: string;
  readonly imageUri?: string | null;
  readonly size?: AvatarSize;
  readonly testID?: string;
}

const SIZE_PX: Readonly<Record<AvatarSize, number>> = {
  sm: 28,
  md: 40,
  lg: 64,
};

const FONT_PX: Readonly<Record<AvatarSize, number>> = {
  sm: 12,
  md: 17,
  lg: 26,
};

const initialFor = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.length === 0) return '·';
  // Keep it ASCII-safe; many emoji + RTL chars render unexpectedly small
  // inside a 28-px circle without a font that handles them.
  const first = trimmed[0] ?? '·';
  return first.toUpperCase();
};

const AvatarImpl: React.FC<AvatarProps> = ({ label, imageUri, size = 'md', testID }) => {
  const dim = SIZE_PX[size];
  const containerStyle = {
    width: dim,
    height: dim,
    borderRadius: dim / 2,
  };
  if (imageUri !== undefined && imageUri !== null && imageUri.length > 0) {
    return (
      <View
        testID={testID}
        accessibilityLabel={`${label} avatar`}
        style={[styles.base, containerStyle]}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, containerStyle]}
          accessibilityLabel={`${label} avatar`}
        />
      </View>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityLabel={`${label} avatar`}
      style={[styles.base, styles.initialWrap, containerStyle]}
    >
      <Text
        style={[styles.initial, { fontSize: FONT_PX[size] }]}
        accessibilityElementsHidden
      >
        {initialFor(label)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initialWrap: {
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
  },
  initial: {
    fontFamily: THEME.fonts.displayBold,
    color: THEME.colors.accent.cyan,
  },
});

export const Avatar = React.memo(AvatarImpl);
Avatar.displayName = 'Avatar';

export default Avatar;
