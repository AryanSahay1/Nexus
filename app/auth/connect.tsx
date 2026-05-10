/**
 * OAuth progress modal — shown while Google authorize() is in flight.
 *
 * Renders a centered branded loading state plus a Cancel action that
 * pops the modal. The actual authorize() call is initiated by the
 * Vault screen; this route exists so progress can be shown over the
 * tab bar via the modal presentation.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { LoadingSpinner } from '../../src/components/shared/LoadingSpinner';
import { getAuthStore } from '../../src/store/authStore';
import { THEME } from '../../src/theme';

const ConnectScreenInner: React.FC = () => {
  const router = useRouter();
  const connecting = useStore(getAuthStore(), (s) => s.connecting);
  const lastError = useStore(getAuthStore(), (s) => s.lastError);

  return (
    <View style={styles.wrap}>
      <Text style={styles.bolt}>⚡</Text>
      <Text style={styles.brand}>NEXUS</Text>
      {connecting ? (
        <>
          <LoadingSpinner label="Waiting for Google…" />
          <Text style={styles.hint}>
            Approve the requested permissions in the Google sheet.
          </Text>
        </>
      ) : lastError !== null ? (
        <>
          <Text style={styles.errorTitle}>Connection failed</Text>
          <Text style={styles.errorMessage}>{lastError.message}</Text>
        </>
      ) : (
        <Text style={styles.hint}>You're all set. Tap Done to return.</Text>
      )}
      <View style={{ marginTop: THEME.spacing.xl, alignSelf: 'stretch' }}>
        <GlowButton
          label={connecting ? 'Cancel' : 'Done'}
          variant={connecting ? 'danger' : 'primary'}
          fullWidth
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
};

const ConnectScreen: React.FC = () => (
  <ErrorBoundary screen="auth_connect">
    <ConnectScreenInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: THEME.colors.background.primary,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolt: { fontSize: 40, color: THEME.colors.accent.cyan },
  brand: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.accent.cyan,
    letterSpacing: 4,
    marginBottom: THEME.spacing.lg,
  },
  hint: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    textAlign: 'center',
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
  errorTitle: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.accent.coral,
  },
  errorMessage: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    textAlign: 'center',
    marginTop: THEME.spacing.sm,
  },
});

export default ConnectScreen;
