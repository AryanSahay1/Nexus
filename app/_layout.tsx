/**
 * Root layout — owns the boot sequence, font loading, splash gate,
 * and the global ErrorBoundary that wraps every screen below.
 */

import { useFonts as useSyne, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  useFonts as useOutfit,
} from '@expo-google-fonts/outfit';
import { JetBrainsMono_400Regular, useFonts as useMono } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '../src/components/shared/ErrorBoundary';
import { LoadingSpinner } from '../src/components/shared/LoadingSpinner';
import { bootstrap } from '../src/services/bootstrap';
import { logError } from '../src/utils/logger';
import { THEME } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  /* tolerate on web/test */
});

type BootStatus = 'pending' | 'ready' | 'failed';

const RootLayout: React.FC = () => {
  const [syneLoaded] = useSyne({ Syne_700Bold, Syne_800ExtraBold });
  const [outfitLoaded] = useOutfit({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });
  const [monoLoaded] = useMono({ JetBrainsMono_400Regular });
  const [bootStatus, setBootStatus] = useState<BootStatus>('pending');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await bootstrap();
      if (cancelled) return;
      if (result.ok) {
        setBootStatus('ready');
      } else {
        logError('boot_failed', { error_code: result.error.code });
        setBootStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fontsLoaded = syneLoaded && outfitLoaded && monoLoaded;
  const isReady = fontsLoaded && bootStatus !== 'pending';

  const onLayout = useCallback(() => {
    if (isReady) {
      void SplashScreen.hideAsync().catch(() => {
        /* ok */
      });
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <View style={styles.splash} onLayout={onLayout}>
        <Animated.View entering={FadeIn.duration(THEME.animation.fastIn)} style={styles.splashInner}>
          <Text style={styles.bolt}>⚡</Text>
          <Text style={styles.brand}>NEXUS</Text>
          <Text style={styles.tagline}>Local AI Agent</Text>
        </Animated.View>
      </View>
    );
  }

  if (bootStatus === 'failed') {
    return (
      <SafeAreaProvider>
        <View style={styles.splash} onLayout={onLayout}>
          <Text style={styles.bolt}>⚠</Text>
          <Text style={styles.brand}>NEXUS</Text>
          <Text style={styles.tagline}>
            Boot failed — restart the app to try again.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.flex} onLayout={onLayout}>
        <ErrorBoundary screen="root">
          <StatusBar style="light" backgroundColor={THEME.colors.background.primary} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: THEME.colors.background.primary },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/connect" options={{ presentation: 'modal' }} />
          </Stack>
        </ErrorBoundary>
        {!isReady ? <LoadingSpinner /> : null}
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
  splashInner: {
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  bolt: {
    fontSize: 40,
    color: THEME.colors.accent.cyan,
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
  },
});

export default RootLayout;
