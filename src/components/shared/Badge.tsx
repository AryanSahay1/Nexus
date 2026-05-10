/**
 * Badge — count or status pill, sized for tab-bar overlays + inline labels.
 *
 * Shows a number when the count is positive, a dot when count === 0
 * with `dotOnZero=true`, and nothing when count === 0 with
 * `dotOnZero=false` (the default).
 *
 * Numbers > 99 render as "99+" so the badge width stays bounded.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { THEME } from '../../theme';

export type BadgeTone = 'cyan' | 'amber' | 'coral' | 'purple';

export interface BadgeProps {
  readonly count?: number;
  readonly label?: string;
  readonly tone?: BadgeTone;
  readonly dotOnZero?: boolean;
  readonly testID?: string;
}

const toneStyle = (
  tone: BadgeTone,
): { bg: string; text: string; border: string } => {
  switch (tone) {
    case 'amber':
      return {
        bg: THEME.colors.accentFill.amberStrong,
        text: THEME.colors.accent.amber,
        border: THEME.colors.border.warning,
      };
    case 'coral':
      return {
        bg: THEME.colors.accentFill.coralStrong,
        text: THEME.colors.accent.coral,
        border: THEME.colors.border.danger,
      };
    case 'purple':
      return {
        bg: THEME.colors.accentFill.purpleStrong,
        text: THEME.colors.accent.purple,
        border: THEME.colors.border.memory,
      };
    case 'cyan':
    default:
      return {
        bg: THEME.colors.accentFill.cyanStrong,
        text: THEME.colors.accent.cyan,
        border: THEME.colors.border.active,
      };
  }
};

const renderLabel = (
  count: number | undefined,
  label: string | undefined,
): string | null => {
  if (typeof label === 'string' && label.length > 0) return label;
  if (typeof count !== 'number' || count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
};

const BadgeImpl: React.FC<BadgeProps> = ({
  count,
  label,
  tone = 'cyan',
  dotOnZero = false,
  testID,
}) => {
  const text = renderLabel(count, label);
  const t = toneStyle(tone);

  if (text === null) {
    if (!dotOnZero) return null;
    return (
      <View
        testID={testID}
        accessibilityLabel="empty badge"
        style={[
          styles.dot,
          { backgroundColor: t.bg, borderColor: t.border },
        ]}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={`badge ${text}`}
      style={[
        styles.pill,
        { backgroundColor: t.bg, borderColor: t.border },
      ]}
    >
      <Text style={[styles.label, { color: t.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  label: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

export const Badge = React.memo(BadgeImpl);
Badge.displayName = 'Badge';

export default Badge;
