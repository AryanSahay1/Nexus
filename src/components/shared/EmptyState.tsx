/**
 * EmptyState — generic centered empty/error placeholder used across
 * the Mail, Calendar, Memory, and Vault screens whenever a list has
 * zero items or the load attempt errored out.
 *
 * Optional `actionLabel` + `onAction` render a primary GlowButton so
 * the user can retry / navigate / refresh in one tap.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { THEME } from '../../theme';

import { GlowButton } from './GlowButton';

export type EmptyStateTone = 'neutral' | 'warning' | 'danger';

export interface EmptyStateProps {
  readonly title: string;
  readonly body?: string;
  readonly glyph?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly tone?: EmptyStateTone;
  readonly testID?: string;
}

const colorFor = (tone: EmptyStateTone): string => {
  switch (tone) {
    case 'warning':
      return THEME.colors.accent.amber;
    case 'danger':
      return THEME.colors.accent.coral;
    case 'neutral':
    default:
      return THEME.colors.text.primary;
  }
};

const EmptyStateImpl: React.FC<EmptyStateProps> = ({
  title,
  body,
  glyph,
  actionLabel,
  onAction,
  tone = 'neutral',
  testID,
}) => (
  <View testID={testID} style={styles.wrap} accessibilityLabel={title}>
    {glyph !== undefined && glyph.length > 0 ? (
      <Text style={[styles.glyph, { color: colorFor(tone) }]}>{glyph}</Text>
    ) : null}
    <Text style={[styles.title, { color: colorFor(tone) }]} numberOfLines={2}>
      {title}
    </Text>
    {body !== undefined && body.length > 0 ? (
      <Text style={styles.body} numberOfLines={4}>
        {body}
      </Text>
    ) : null}
    {actionLabel !== undefined && onAction !== undefined ? (
      <View style={styles.action}>
        <GlowButton label={actionLabel} variant="primary" onPress={onAction} />
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
    gap: THEME.spacing.sm,
  },
  glyph: {
    fontSize: 48,
    marginBottom: THEME.spacing.md,
  },
  title: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.xl,
    textAlign: 'center',
  },
  body: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    textAlign: 'center',
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
    maxWidth: 320,
  },
  action: {
    marginTop: THEME.spacing.lg,
  },
});

export const EmptyState = React.memo(EmptyStateImpl);
EmptyState.displayName = 'EmptyState';

export default EmptyState;
