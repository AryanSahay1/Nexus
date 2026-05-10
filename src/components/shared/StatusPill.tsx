/**
 * StatusPill — small color-coded badge used for connection state and tags.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { THEME } from '../../theme';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusPillProps {
  readonly label: string;
  readonly tone?: StatusTone;
  readonly testID?: string;
}

const toneStyle = (
  tone: StatusTone,
): { color: string; bg: string; border: string } => {
  switch (tone) {
    case 'success':
      return {
        color: THEME.colors.accent.green,
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
      };
    case 'warning':
      return {
        color: THEME.colors.accent.amber,
        bg: THEME.colors.accentFill.amberStrong,
        border: THEME.colors.border.warning,
      };
    case 'danger':
      return {
        color: THEME.colors.accent.coral,
        bg: THEME.colors.accentFill.coralStrong,
        border: THEME.colors.border.danger,
      };
    case 'info':
      return {
        color: THEME.colors.accent.cyan,
        bg: THEME.colors.accentFill.cyanStrong,
        border: THEME.colors.border.active,
      };
    case 'neutral':
    default:
      return {
        color: THEME.colors.text.secondary,
        bg: 'rgba(136,136,160,0.10)',
        border: 'rgba(136,136,160,0.25)',
      };
  }
};

const StatusPillImpl: React.FC<StatusPillProps> = ({ label, tone = 'neutral', testID }) => {
  const t = toneStyle(tone);
  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <Text style={[styles.label, { color: t.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

export const StatusPill = React.memo(StatusPillImpl);
StatusPill.displayName = 'StatusPill';

export default StatusPill;
