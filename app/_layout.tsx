/**
 * Root layout — boot sequence + font loader + splash gate + ErrorBoundary.
 *
 * Boot failure UI follows Dr. Elena Vasquez's hardening protocol: when
 * a critical step fails, the screen surfaces the *specific step name*
 * and *error code* in monospace, so a user / support engineer can
 * diagnose the failure without log diving. The error code is pulled
 * from the typed NexusError, never from a stack trace, so no PII leaks.
 */

import {
  useFonts as useSyne,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  useFonts as useOutfit,
} from '@expo-google-fonts/outfit';
import {
  JetBrainsMono_400Regular,
  useFonts as useMono,
} from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '../src/components/shared/ErrorBoundary';
import { bootstrap, type BootstrapResult } from '../src/services/bootstrap';
import { type BootFailure } from '../src/utils/bootSequencer';
import { logError, logEvent } from '../src/utils/logger';
import { THEME } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  /* tolerate failures here — fires before the native splash is ready in some edge cases */
});

type BootState =
  | { kind: 'pending' }
  | { kind: 'ready'; report: BootstrapResult }
  | { kind: 'failed'; failure: BootFailure };

const RootLayout: React.FC = () => {
  const [syneLoaded] = useSyne({ Syne_700Bold, Syne_800ExtraBold });
  const [outfitLoaded] = useOutfit({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });
  const [monoLoaded] = useMono({ JetBrainsMono_400Regular });
  const [boot, setBoot] = useState<BootState>({ kind: 'pending' });
  const [retryCounter, setRetryCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await bootstrap();
        if (cancelled) return;
        if (result.ok) {
          setBoot({ kind: 'ready', report: result.value });
          logEvent('boot_ok', {
            iteration: result.value.stepsCompleted,
            total_latency_ms: result.value.totalLatencyMs,
          });
        } else {
          logError('boot_failed', {
            tool_name: result.error.stepId,
            error_code: result.error.error.code,
          });
          setBoot({ kind: 'failed', failure: result.error });
        }
      } catch (caught) {
        // Defense-in-depth: bootstrap() should never throw because every
        // step is wrapped, but if it somehow does we still surface a
        // typed failure rather than letting React's ErrorBoundary above
        // catch it generically.
        if (cancelled) return;
        logError('boot_threw', {});
        setBoot({
          kind: 'failed',
          failure: {
            stepId: 'unknown',
            error: {
              name: 'NexusError',
              code: 'UNKNOWN',
              message:
                caught instanceof Error
                  ? caught.message
                  : 'unknown error during bootstrap()',
              isRetryable: false,
            } as never,
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // retryCounter forces a fresh attempt when the user taps Retry.
  }, [retryCounter]);

  const fontsLoaded = syneLoaded && outfitLoaded && monoLoaded;
  const isReady = fontsLoaded && boot.kind === 'ready';
  const isFailed = fontsLoaded && boot.kind === 'failed';

  const onLayout = useCallback(() => {
    if (isReady || isFailed) {
      void SplashScreen.hideAsync().catch(() => {
        /* idempotent; safe to ignore double-hide */
      });
    }
  }, [isReady, isFailed]);

  const handleRetry = useCallback((): void => {
    setBoot({ kind: 'pending' });
    setRetryCounter((c) => c + 1);
  }, []);

  if (!fontsLoaded || boot.kind === 'pending') {
    return (
      <View style={styles.splash} onLayout={onLayout}>
        <Animated.View
          entering={FadeIn.duration(THEME.animation.fastIn)}
          style={styles.splashInner}
        >
          <Text style={styles.bolt}>⚡</Text>
          <Text style={styles.brand}>NEXUS</Text>
          <Text style={styles.tagline}>Local AI Agent</Text>
        </Animated.View>
      </View>
    );
  }

  if (boot.kind === 'failed') {
    return (
      <SafeAreaProvider>
        <View style={styles.splash} onLayout={onLayout}>
          <Text style={styles.errorGlyph}>⚠</Text>
          <Text style={styles.brand}>NEXUS</Text>
          <Text style={styles.tagline}>Boot failed.</Text>
          <View style={styles.diagWrap}>
            <Text style={styles.diagLabel}>Step</Text>
            <Text style={styles.diagValue}>{boot.failure.stepId}</Text>
            <Text style={styles.diagLabel}>Error</Text>
            <Text style={styles.diagValue}>{boot.failure.error.code}</Text>
            <Text style={styles.diagMessage}>{boot.failure.error.message}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry boot"
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.retryButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.flex} onLayout={onLayout}>
        <ErrorBoundary screen="root">
          <StatusBar
            style="light"
            backgroundColor={THEME.colors.background.primary}
          />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: THEME.colors.background.primary },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="auth/connect"
              options={{ presentation: 'modal' }}
            />
          </Stack>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  splash: {
    flex: 1,
    backgroundColor: THEME.colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
  },
  splashInner: { alignItems: 'center', gap: THEME.spacing.sm },
  bolt: { fontSize: 40, color: THEME.colors.accent.cyan },
  errorGlyph: {
    fontSize: 40,
    color: THEME.colors.accent.coral,
    marginBottom: THEME.spacing.sm,
  },
  brand: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.accent.cyan,
    letterSpacing: 4,
  },
  tagline: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
  },
  diagWrap: {
    marginTop: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border.danger,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.accentFill.coralStrong,
    minWidth: '70%',
  },
  diagLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: THEME.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  diagValue: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
    marginTop: 2,
  },
  diagMessage: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.md,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
  retryButton: {
    marginTop: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.xxl,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
  },
  retryLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.accent.cyan,
    letterSpacing: 0.4,
  },
});

export default RootLayout;
