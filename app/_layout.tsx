/**
 * Root layout for the Nexus app.
 *
 * Initializes the SQLite database, wires the OAuth refresh hook into the
 * apiClient, and registers the default tool set. The tab navigator is
 * mounted inside an error boundary that surfaces any boot failure to the
 * user instead of leaving them on a white screen.
 *
 * Boot order (matches the directive):
 *   1. Initialize SQLite                 ← idempotent
 *   2. Register default tools             ← in-memory map
 *   3. Wire apiClient ↔ oauthService     ← installs refresh handler
 *   4. Render tab navigator
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '../src/db/database';
import { wireApiClientRefresh } from '../src/services/oauthService';
import { registerDefaultTools } from '../src/tools';

interface BootState {
  readonly status: 'pending' | 'ready' | 'failed';
  readonly errorMessage: string | null;
}

export default function RootLayout(): React.ReactElement {
  const [boot, setBoot] = useState<BootState>({ status: 'pending', errorMessage: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await initializeDatabase();
      if (cancelled) return;
      if (!db.ok) {
        setBoot({ status: 'failed', errorMessage: db.error.message });
        return;
      }
      registerDefaultTools();
      wireApiClientRefresh();
      setBoot({ status: 'ready', errorMessage: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (boot.status === 'pending') {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator size="large" color="#7C5CFF" />
        <Text style={styles.bootMessage}>Starting Nexus…</Text>
      </View>
    );
  }
  if (boot.status === 'failed') {
    return (
      <View style={styles.bootContainer}>
        <Text style={styles.bootHeading}>Nexus could not start.</Text>
        <Text style={styles.bootMessage}>{boot.errorMessage ?? 'Unknown error.'}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0B0F14' },
          headerTintColor: '#F4ECDF',
          contentStyle: { backgroundColor: '#0B0F14' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="confirm"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F14',
    padding: 24,
  },
  bootHeading: {
    color: '#F4ECDF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  bootMessage: {
    color: '#A8A8C2',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});
