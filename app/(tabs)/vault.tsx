/**
 * Vault screen — manage connected providers.
 *
 * Reads the snapshot from `useVaultStore` and exposes connect/disconnect
 * affordances. The OpenAI tile is a manual API-key field (no OAuth);
 * Google goes through the PKCE flow via `oauthService.connect`. WhatsApp
 * surfaces as "coming soon" until we wire the WhatsApp Business API.
 */

import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { connect as oauthConnect, disconnect as oauthDisconnect } from '../../src/services/oauthService';
import * as tokenService from '../../src/services/tokenService';
import { useUiStore } from '../../src/store/uiStore';
import { useVaultStore } from '../../src/store/vaultStore';
import type { Provider, ServiceConnection } from '../../src/types/auth';

export default function VaultScreen(): React.ReactElement {
  const snapshot = useVaultStore((s) => s.snapshot);
  const refresh = useVaultStore((s) => s.refresh);
  const isRefreshing = useVaultStore((s) => s.isRefreshing);
  const errorMessage = useVaultStore((s) => s.errorMessage);
  const requestConfirmation = useUiStore((s) => s.request);

  const [openAiKeyDraft, setOpenAiKeyDraft] = useState('');
  const [googleClientIdDraft, setGoogleClientIdDraft] = useState('');
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const performDisconnect = useCallback(
    async (provider: Provider): Promise<void> => {
      setBusyProvider(provider);
      setLocalError(null);
      const result = await oauthDisconnect(provider);
      setBusyProvider(null);
      if (!result.ok) {
        setLocalError(result.error.message);
      }
      await refresh();
    },
    [refresh],
  );

  const handleConnectGoogle = useCallback(async (): Promise<void> => {
    if (googleClientIdDraft.trim().length === 0) {
      setLocalError('Paste your Google OAuth Client ID first.');
      return;
    }
    setBusyProvider('google');
    setLocalError(null);
    const result = await oauthConnect(googleClientIdDraft.trim());
    setBusyProvider(null);
    if (!result.ok) {
      setLocalError(result.error.message);
    } else {
      setGoogleClientIdDraft('');
    }
    await refresh();
  }, [googleClientIdDraft, refresh]);

  const handleSaveOpenAiKey = useCallback(async (): Promise<void> => {
    const key = openAiKeyDraft.trim();
    if (!key.startsWith('sk-') || key.length < 20) {
      setLocalError('OpenAI keys start with "sk-" and contain at least 20 characters.');
      return;
    }
    setBusyProvider('openai');
    setLocalError(null);
    const result = await tokenService.setToken('openai', 'apiKey', key);
    setBusyProvider(null);
    if (!result.ok) {
      setLocalError(result.error.message);
    } else {
      setOpenAiKeyDraft('');
    }
    await refresh();
  }, [openAiKeyDraft, refresh]);

  const handleConfirmDisconnect = useCallback(
    (provider: Provider): void => {
      requestConfirmation({
        id: `disconnect-${provider}`,
        title: `Disconnect ${labelFor(provider)}?`,
        body: `This deletes every credential for ${labelFor(provider)} from this device.`,
        confirmLabel: 'Disconnect',
        cancelLabel: 'Keep it',
        destructive: true,
        onConfirm: () => {
          void performDisconnect(provider);
        },
        onCancel: () => undefined,
      });
      router.push('/confirm');
    },
    [requestConfirmation, performDisconnect],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Connected services</Text>
      <Text style={styles.body}>
        Tokens never leave this device. Reconnecting wipes the previous credentials.
      </Text>
      {(localError ?? errorMessage) !== null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{localError ?? errorMessage}</Text>
        </View>
      )}

      <ProviderTile
        title="OpenAI"
        connection={snapshot?.openai ?? null}
        busy={busyProvider === 'openai' || isRefreshing}
        onDisconnect={() => handleConfirmDisconnect('openai')}
      >
        {snapshot?.openai.status !== 'connected' && (
          <View style={styles.fieldRow}>
            <TextInput
              value={openAiKeyDraft}
              onChangeText={setOpenAiKeyDraft}
              placeholder="sk-…"
              placeholderTextColor="#A8A8C2"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
              ]}
              onPress={handleSaveOpenAiKey}
            >
              <Text style={styles.ctaText}>Save key</Text>
            </Pressable>
          </View>
        )}
      </ProviderTile>

      <ProviderTile
        title="Google"
        connection={snapshot?.google ?? null}
        busy={busyProvider === 'google' || isRefreshing}
        onDisconnect={() => handleConfirmDisconnect('google')}
      >
        {snapshot?.google.status !== 'connected' && (
          <View style={styles.fieldRow}>
            <TextInput
              value={googleClientIdDraft}
              onChangeText={setGoogleClientIdDraft}
              placeholder="xxxxx.apps.googleusercontent.com"
              placeholderTextColor="#A8A8C2"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={handleConnectGoogle}
            >
              <Text style={styles.ctaText}>Connect</Text>
            </Pressable>
          </View>
        )}
      </ProviderTile>

      <ProviderTile
        title="WhatsApp"
        connection={snapshot?.whatsapp ?? null}
        busy={false}
        onDisconnect={() => undefined}
        comingSoon
      />
    </ScrollView>
  );
}

const labelFor = (provider: Provider): string => {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'openai':
      return 'OpenAI';
    case 'whatsapp':
      return 'WhatsApp';
    /* istanbul ignore next */
    default:
      return provider;
  }
};

interface ProviderTileProps {
  readonly title: string;
  readonly connection: ServiceConnection | null;
  readonly busy: boolean;
  readonly onDisconnect: () => void;
  readonly comingSoon?: boolean;
  readonly children?: React.ReactNode;
}
const ProviderTile: React.FC<ProviderTileProps> = ({
  title,
  connection,
  busy,
  onDisconnect,
  comingSoon = false,
  children,
}) => {
  const isConnected = connection?.status === 'connected';
  return (
    <View style={[styles.tile, isConnected && styles.tileConnected]}>
      <View style={styles.tileHeader}>
        <Text style={styles.tileTitle}>{title}</Text>
        {comingSoon && <Text style={styles.tileBadge}>Coming soon</Text>}
        {!comingSoon && isConnected && (
          <Text style={[styles.tileBadge, styles.tileBadgeConnected]}>Connected</Text>
        )}
      </View>
      {isConnected && connection?.userEmail !== null && connection?.userEmail !== undefined && (
        <Text style={styles.tileEmail}>{connection.userEmail}</Text>
      )}
      {children}
      {isConnected && (
        <Pressable
          style={({ pressed }) => [
            styles.disconnectButton,
            pressed && styles.disconnectButtonPressed,
          ]}
          onPress={onDisconnect}
          disabled={busy}
        >
          <Text style={styles.disconnectText}>Disconnect</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  content: { padding: 16, gap: 16 },
  heading: { color: '#F4ECDF', fontSize: 22, fontWeight: '600' },
  body: { color: '#A8A8C2', fontSize: 14, lineHeight: 20 },
  errorBanner: {
    backgroundColor: '#A53B33',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: { color: '#FFF8EC', fontSize: 13 },
  tile: {
    backgroundColor: '#15151F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    padding: 16,
    gap: 12,
  },
  tileConnected: { borderColor: '#4FA45A' },
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileTitle: { color: '#F4ECDF', fontSize: 18, fontWeight: '600' },
  tileBadge: { color: '#A8A8C2', fontSize: 12, fontWeight: '600' },
  tileBadgeConnected: { color: '#9DD174' },
  tileEmail: { color: '#A8A8C2', fontSize: 13 },
  fieldRow: { gap: 8 },
  input: {
    backgroundColor: '#0B0F14',
    color: '#F4ECDF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
    borderColor: '#2A2A3A',
    borderWidth: 1,
  },
  cta: {
    backgroundColor: '#7C5CFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: '#FFF8EC', fontSize: 14, fontWeight: '600' },
  disconnectButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A53B33',
    alignItems: 'center',
  },
  disconnectButtonPressed: { opacity: 0.7 },
  disconnectText: { color: '#A53B33', fontSize: 14, fontWeight: '600' },
});
