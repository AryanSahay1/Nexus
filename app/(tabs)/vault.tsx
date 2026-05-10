/**
 * Vault screen — connect Google + manage OpenAI API key.
 */

import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { StatusPill } from '../../src/components/shared/StatusPill';
import { ServiceCard } from '../../src/components/vault/ServiceCard';
import {
  buildVaultGoogleConnectSteps,
  buildVaultOpenAiSetupSteps,
  useTour,
} from '../../src/components/guide';
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

  // ── Guided tour wiring ───────────────────────────────────────────
  // Refs are attached to ServiceCards / inputs / buttons via the
  // `<View ref={…}>` pattern; the tour engine measures them at start
  // time and drives the spotlight.
  const openAiCardRef = useRef<View>(null);
  const openAiInputRef = useRef<View>(null);
  const openAiSaveRef = useRef<View>(null);
  const googleCardRef = useRef<View>(null);
  const googleConnectRef = useRef<View>(null);

  const openAiTour = useTour(
    'vault_openai_setup',
    buildVaultOpenAiSetupSteps({
      card: openAiCardRef,
      input: openAiInputRef,
      saveButton: openAiSaveRef,
    }),
  );
  const googleTour = useTour(
    'vault_google_connect',
    buildVaultGoogleConnectSteps({
      card: googleCardRef,
      connectButton: googleConnectRef,
    }),
  );

  const openAiConnected = snapshot.openai.status === 'connected';
  const googleConnected = snapshot.google.status === 'connected';

  useEffect(() => {
    if (!openAiConnected) {
      void openAiTour.startTour();
    } else if (!googleConnected) {
      void googleTour.startTour();
    }
  }, [openAiConnected, googleConnected, openAiTour, googleTour]);

  // Read once per render so the missing-env state stays in sync with any
  // hot reload during dev. Empty string ⇒ env var not set ⇒ ServiceCard
  // shows a yellow setup pill instead of the OAuth button.
  const googleClientId = readEnvClientId();
  const googleAvailable = googleClientId.length > 0;

  const handleConnectGoogle = useCallback(async () => {
    if (!googleAvailable) {
      // Defence in depth — the ServiceCard already hides the button, but
      // if anything else triggers the path we surface a hint instead of
      // crashing inside the OAuth flow.
      Alert.alert(
        'Google not configured',
        'Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your .env file. See docs/GOOGLE_SETUP.md for the step-by-step setup.',
      );
      return;
    }
    const r = await getAuthStore().getState().connectGoogle(googleClientId);
    if (!r.ok) {
      Alert.alert('Connect failed', r.error.message);
    }
  }, [googleAvailable, googleClientId]);

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

      <View ref={googleCardRef} collapsable={false}>
        <ServiceCard
          provider="google"
          connection={snapshot.google}
          onConnect={() => void handleConnectGoogle()}
          onDisconnect={handleDisconnectGoogle}
          disabled={connecting || disconnecting}
          connectButtonRef={googleConnectRef}
          {...(googleAvailable
            ? {}
            : { unavailableReason: 'Set EXPO_PUBLIC_GOOGLE_CLIENT_ID to enable' })}
        />
      </View>

      <View ref={openAiCardRef} collapsable={false}>
        <ServiceCard
          provider="openai"
          connection={snapshot.openai}
          onConnect={() => {
            // Just focus the field — the actual save is on the button below.
          }}
          onDisconnect={handleClearApiKey}
          disabled={savingKey}
        />
      </View>

      {snapshot.openai.status === 'disconnected' ? (
        <ClawPanel style={styles.keyPanel}>
          <View ref={openAiInputRef} collapsable={false}>
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
              testID="vault-openai-input"
            />
          </View>
          {keyError !== null ? <Text style={styles.keyError}>{keyError}</Text> : null}
          <View
            ref={openAiSaveRef}
            collapsable={false}
            style={{ marginTop: THEME.spacing.md }}
          >
            <GlowButton
              label="Save key"
              variant="primary"
              fullWidth
              loading={savingKey}
              disabled={apiKeyInput.trim().length === 0}
              onPress={() => void handleSaveApiKey()}
              testID="vault-openai-save"
            />
          </View>
        </ClawPanel>
      ) : (
        <ClawPanel style={styles.keyPanel}>
          <Text style={styles.keyMasked}>{maskTail('sk-' + 'x'.repeat(20))}</Text>
        </ClawPanel>
      )}

      <ClawPanel style={styles.whatsappPanel} testID="vault-whatsapp-panel">
        <View style={styles.whatsappHeader}>
          <Text style={styles.whatsappTitle}>WhatsApp</Text>
          <StatusPill label="Ready" tone="success" testID="vault-whatsapp-status" />
        </View>
        <Text style={styles.whatsappBody}>
          WhatsApp sends via your installed WhatsApp app. No login required.
        </Text>
      </ClawPanel>

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
      </ClawPanel>
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
  whatsappPanel: {
    marginTop: THEME.spacing.md,
  },
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whatsappTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  whatsappBody: {
    marginTop: THEME.spacing.sm,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
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
