/**
 * LoadingSpinner — branded inline spinner used by the splash and async UIs.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { THEME } from '../../theme';

export interface LoadingSpinnerProps {
  readonly label?: string;
  readonly testID?: string;
}

const LoadingSpinnerImpl: React.FC<LoadingSpinnerProps> = ({ label, testID }) => (
  <View testID={testID} style={styles.wrap}>
    <ActivityIndicator color={THEME.colors.accent.cyan} size="large" />
    {label !== undefined && label.length > 0 ? <Text style={styles.label}>{label}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  label: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
  },
});

export const LoadingSpinner = React.memo(LoadingSpinnerImpl);
LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
