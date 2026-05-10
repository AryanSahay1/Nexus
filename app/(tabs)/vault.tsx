/**
 * Vault screen — connect Google + manage OpenAI API key.
 */

import Constants from 'expo-constants';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { ServiceCard } from '../../src/components/vault/ServiceCard';
import { validateApiKey } from '../../src/services/openaiService';
import { getAuthStore } from '../../src/store/authStore';
import { getSettingsStore } from '../../src/store/settingsStore';
import { getVaultStore } from '../../src/store/vaultStore';
import { THEME } from '../../src/theme';

const readEnvClientId = (): string => {
  const fromExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromConfig = fromExtra['EXPO_PUBLIC_GOOGLE_CLIENT_ID'];
  return typeof fromConfig === 'string' ? fromConfig : '';
};

const maskTail = (key: string | null): string => {
  if (key === null || key.length < 4) return '';
  return `•••• ${key.slice(-4)}`;
};

const VaultScreenInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const snapshot = useStore(getVaultStore(), (s) => s.snapshot);
  const connecting = useStore(getAuthStore(), (s) => s.connecting);
  const disconnecting = useStore(getAuthStore(), (s) => s.disconnecting);
  const baseUrl = useStore(getSettingsStore(), (s) => s.baseUrl);
  const model = useStore(getSettingsStore(), (s) => s.model);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  const handleConnectGoogle = useCallback(async () => {
    const clientId = readEnvClientId();
    if (clientId.length === 0) {
      Alert.alert(
        'Google not configured',
        'Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your .env file. See docs/GOOGLE_SETUP.md for the step-by-step setup.',
      );
      return;
    }
    const r = await getAuthStore().getState().connectGoogle(clientId);
    if (!r.ok) {
      Alert.alert('Connect failed', r.error.message);
    }
  }, []);

  const handleDisconnectGoogle = useCallback(() => {
    Alert.alert(
      'Disconnect Google?',
      'This will delete your stored Google tokens from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = await getAuthStore().getState().disconnectGoogle();
              if (!r.ok) Alert.alert('Disconnect failed', r.error.message);
            })();
          },
        },
      ],
    );
  }, []);

  const handleSaveApiKey = useCallback(async () => {
    setKeyError(null);
    const validation = validateApiKey(apiKeyInput);
    if (!validation.ok) {
      setKeyError(validation.error.message);
      return;
    }
    setSavingKey(true);
    try {
      const r = await getSettingsStore().getState().setOpenAiApiKey(validation.value);
      if (!r.ok) {
        setKeyError(r.error.message);
        return;
      }
      // Refresh vault state so the openai card flips to connected.
      await getVaultStore().getState().hydrate();
      getVaultStore().getState().markConnected('openai');
      setApiKeyInput('');
    } finally {
      setSavingKey(false);
    }
  }, [apiKeyInput]);

  const handleClearApiKey = useCallback(() => {
    Alert.alert('Remove API key?', 'You can paste it again any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await getSettingsStore().getState().clearOpenAiApiKey();
            getVaultStore().getState().markDisconnected('openai');
          })();
        },
      },
    ]);
  }, []);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + THEME.spacing.lg }]}
    >
      <Text style={styles.heading}>VAULT</Text>
      <Text style={styles.subheading}>Connected accounts and credentials</Text>

      <ServiceCard
        provider="google"
        connection={snapshot.google}
        onConnect={() => void handleConnectGoogle()}
        onDisconnect={handleDisconnectGoogle}
        disabled={connecting || disconnecting}
      />

      <ServiceCard
        provider="openai"
        connection={snapshot.openai}
        onConnect={() => {
          // Just focus the field — the actual save is on the button below.
        }}
        onDisconnect={handleClearApiKey}
        disabled={savingKey}
      />

      {snapshot.openai.status === 'disconnected' ? (
        <ClawPanel style={styles.keyPanel}>
          <Text style={styles.keyTitle}>Paste your OpenAI API key</Text>
          <Text style={styles.keyHint}>
            Stored only on this device in the secure enclave. Format: sk-…
          </Text>
          <TextInput
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder="sk-…"
            placeholderTextColor={THEME.colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.keyInput}
            accessibilityLabel="OpenAI API key"
          />
          {keyError !== null ? <Text style={styles.keyError}>{keyError}</Text> : null}
          <View style={{ marginTop: THEME.spacing.md }}>
            <GlowButton
              label="Save key"
              variant="primary"
              fullWidth
              loading={savingKey}
              disabled={apiKeyInput.trim().length === 0}
              onPress={() => void handleSaveApiKey()}
            />
          </View>
        </ClawPanel>
      ) : (
        <ClawPanel style={styles.keyPanel}>
          <Text style={styles.keyTitle}>OpenAI API key</Text>
          <Text style={styles.keyMasked}>{maskTail('sk-' + 'x'.repeat(20))}</Text>
          <Text style={styles.keyHint}>
            Mask shown for security. Use Disconnect to remove.
          </Text>
        </ClawPanel>
      )}

      <ClawPanel style={styles.summaryPanel}>
        <Text style={styles.summaryTitle}>AI provider</Text>
        <Text style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Endpoint: </Text>
          <Text style={styles.summaryValue}>{baseUrl}</Text>
        </Text>
        <Text style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Model: </Text>
          <Text style={styles.summaryValue}>{model}</Text>
        </Text>
        <Text style={styles.summaryHint}>
          Adjust in Settings. See docs/GOOGLE_SETUP.md for the free Google Cloud setup.
        </Text>
      </ClawPanel>

      <Pressable style={{ paddingVertical: THEME.spacing.md, alignItems: 'center' }}>
        <Text style={styles.footnote}>
          Tokens are encrypted on-device and never leave this phone.
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const VaultScreen: React.FC = () => (
  <ErrorBoundary screen="vault">
    <VaultScreenInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  content: { padding: THEME.spacing.lg, paddingBottom: THEME.spacing.xxxl },
  heading: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.text.primary,
    letterSpacing: 4,
  },
  subheading: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.xl,
  },
  keyPanel: { marginBottom: THEME.spacing.lg },
  keyTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  keyHint: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.muted,
    marginTop: 4,
  },
  keyInput: {
    marginTop: THEME.spacing.md,
    backgroundColor: THEME.colors.background.elevated,
    borderColor: THEME.colors.border.default,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  keyError: {
    marginTop: THEME.spacing.sm,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.danger,
  },
  keyMasked: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.accent.cyan,
    marginTop: THEME.spacing.sm,
  },
  summaryPanel: {
    marginTop: THEME.spacing.md,
  },
  summaryTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginBottom: THEME.spacing.sm,
  },
  summaryRow: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
  summaryLabel: { color: THEME.colors.text.secondary },
  summaryValue: { color: THEME.colors.text.primary, fontFamily: THEME.fonts.mono },
  summaryHint: {
    marginTop: THEME.spacing.sm,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
  },
  footnote: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
  },
});

export default VaultScreen;
