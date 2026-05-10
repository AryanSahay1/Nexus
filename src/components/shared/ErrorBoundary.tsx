/**
 * ErrorBoundary — class component required at the root of every screen.
 *
 * `componentDidCatch` logs only the screen name and a stable error code
 * — never the full stack trace, never the error message verbatim, since
 * an upstream error from a third-party library could include user data
 * (LAW 2). The fallback UI offers a reload action that simply remounts
 * the wrapped subtree.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { THEME } from '../../theme';
import { logError } from '../../utils/logger';

export interface ErrorBoundaryProps {
  readonly screen: string;
  readonly children: React.ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly resetKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    logError('error_boundary_caught', { screen: this.props.screen });
  }

  private readonly handleReset = (): void => {
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>Something went wrong.</Text>
        <Text style={styles.body}>
          Nexus hit an unexpected error on this screen. Tap reload to try again — your data is safe.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.handleReset}
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.buttonLabel}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: THEME.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.text.danger,
    textAlign: 'center',
  },
  body: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    textAlign: 'center',
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
  },
  button: {
    marginTop: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
  },
  buttonLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.accent.cyan,
  },
});

export default ErrorBoundary;
