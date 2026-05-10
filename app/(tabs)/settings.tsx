/**
 * Settings screen — AI provider, model, temperature, UX toggles, info, danger zone.
 */

import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Avatar } from '../../src/components/shared/Avatar';
import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { StatusPill } from '../../src/components/shared/StatusPill';
import * as emailRepository from '../../src/db/emailRepository';
import * as eventRepository from '../../src/db/eventRepository';
import { useAuth } from '../../src/hooks/useAuth';
import { getChatStore } from '../../src/store/chatStore';
import {
  detectActiveProfile,
  getSettingsStore,
} from '../../src/store/settingsStore';
import { getVaultStore } from '../../src/store/vaultStore';
import { PROVIDER_PROFILES } from '../../src/types/settings';
import { THEME } from '../../src/theme';

const MODEL_PRESETS: readonly string[] = [
  'gpt-4o-mini',
  'gpt-4o',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
];

const SettingsScreenInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const baseUrl = useStore(getSettingsStore(), (s) => s.baseUrl);
  const model = useStore(getSettingsStore(), (s) => s.model);
  const temperature = useStore(getSettingsStore(), (s) => s.temperature);
  const hapticsEnabled = useStore(getSettingsStore(), (s) => s.hapticsEnabled);
  const streamingEnabled = useStore(getSettingsStore(), (s) => s.streamingEnabled);

  const [baseDraft, setBaseDraft] = useState<string>(baseUrl);
  const [modelDraft, setModelDraft] = useState<string>(model);

  React.useEffect(() => {
    setBaseDraft(baseUrl);
  }, [baseUrl]);
  React.useEffect(() => {
    setModelDraft(model);
  }, [model]);

  const activeProfile = detectActiveProfile(baseUrl);

  const handleProviderTap = useCallback(
    async (id: 'openai' | 'groq' | 'custom') => {
      const profile = PROVIDER_PROFILES.find((p) => p.id === id);
      if (!profile) return;
      await getSettingsStore().getState().applyProviderProfile(profile);
    },
    [],
  );

  const handleSaveBase = useCallback(async () => {
    if (baseDraft === baseUrl) return;
    await getSettingsStore().getState().setBaseUrl(baseDraft);
  }, [baseDraft, baseUrl]);

  const handleSaveModel = useCallback(async () => {
    if (modelDraft === model) return;
    await getSettingsStore().getState().setModel(modelDraft);
  }, [modelDraft, model]);

  const handleTempStep = useCallback(
    async (delta: number) => {
      const next = Math.round((temperature + delta) * 10) / 10;
      await getSettingsStore().getState().setTemperature(next);
    },
    [temperature],
  );

  const handleResetEverything = useCallback(() => {
    Alert.alert(
      'Factory reset?',
      'This wipes ALL credentials, saved memories, chat history, and cached email/calendar data on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await auth.wipeAllCredentials();
              await getChatStore().getState().clearHistory();
              await emailRepository.clear();
              await eventRepository.clear();
              getVaultStore().getState().markDisconnected('google');
              getVaultStore().getState().markDisconnected('openai');
              getVaultStore().getState().markDisconnected('whatsapp');
            })();
          },
        },
      ],
    );
  }, [auth]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + THEME.spacing.lg }]}
    >
      <Text style={styles.heading}>SETTINGS</Text>
      <Text style={styles.subheading}>Configure your AI provider and behavior.</Text>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.accountRow}>
          <Avatar
            label={auth.googleEmail ?? 'Nexus user'}
            size="md"
          />
          <View style={styles.accountIdentity}>
            <Text style={styles.accountName} numberOfLines={1}>
              {auth.googleEmail ?? 'Not signed in'}
            </Text>
            <View style={styles.accountStatusRow}>
              <StatusPill
                label={auth.googleConnected ? 'Google' : 'No Google'}
                tone={auth.googleConnected ? 'success' : 'neutral'}
              />
              <StatusPill
                label={auth.openAiConfigured ? 'AI key' : 'No AI key'}
                tone={auth.openAiConfigured ? 'success' : 'neutral'}
              />
            </View>
          </View>
        </View>
        {auth.googleConnected ? (
          <View style={{ marginTop: THEME.spacing.md }}>
            <GlowButton
              label="Sign out of Google"
              variant="danger"
              fullWidth
              loading={auth.disconnecting}
              onPress={() => {
                Alert.alert(
                  'Sign out of Google?',
                  'This wipes the stored Google tokens from this device. The app keeps working — you can reconnect any time from Vault.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      style: 'destructive',
                      onPress: () => {
                        void auth.disconnectGoogle();
                      },
                    },
                  ],
                );
              }}
            />
          </View>
        ) : null}
      </ClawPanel>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>Connected services & memories</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open vault"
          onPress={() => router.push('/(tabs)/vault')}
          style={styles.linkRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.linkLabel}>Vault</Text>
            <Text style={styles.linkHint}>API keys and Google connection</Text>
          </View>
          <Text style={styles.linkArrow}>›</Text>
        </Pressable>
        <View style={styles.linkDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open memory"
          onPress={() => router.push('/(tabs)/memory')}
          style={styles.linkRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.linkLabel}>Memory</Text>
            <Text style={styles.linkHint}>Saved facts and preferences</Text>
          </View>
          <Text style={styles.linkArrow}>›</Text>
        </Pressable>
      </ClawPanel>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>AI provider</Text>
        <View style={styles.providerRow}>
          {PROVIDER_PROFILES.map((p) => {
            const active = p.id === activeProfile;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => void handleProviderTap(p.id)}
                style={[styles.providerChip, active && styles.providerChipActive]}
              >
                <Text style={[styles.providerLabel, active && styles.providerLabelActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.fieldLabel}>Base URL</Text>
        <TextInput
          value={baseDraft}
          onChangeText={setBaseDraft}
          onBlur={() => void handleSaveBase()}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Model</Text>
        <TextInput
          value={modelDraft}
          onChangeText={setModelDraft}
          onBlur={() => void handleSaveModel()}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelRow}>
          {MODEL_PRESETS.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setModelDraft(m);
                void getSettingsStore().getState().setModel(m);
              }}
              style={[styles.modelChip, m === model && styles.modelChipActive]}
            >
              <Text
                style={[styles.modelChipLabel, m === model && styles.modelChipLabelActive]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </ClawPanel>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>Temperature</Text>
        <View style={styles.tempRow}>
          <Pressable
            onPress={() => void handleTempStep(-0.1)}
            accessibilityLabel="Decrease temperature"
            style={styles.tempButton}
          >
            <Text style={styles.tempButtonLabel}>−</Text>
          </Pressable>
          <Text style={styles.tempValue}>{temperature.toFixed(1)}</Text>
          <Pressable
            onPress={() => void handleTempStep(0.1)}
            accessibilityLabel="Increase temperature"
            style={styles.tempButton}
          >
            <Text style={styles.tempButtonLabel}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.tempCaption}>Precise (0.0) — Balanced (0.7) — Creative (1.0+)</Text>
      </ClawPanel>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Haptic feedback</Text>
          <Switch
            value={hapticsEnabled}
            onValueChange={(v) => {
              void getSettingsStore().getState().setHapticsEnabled(v);
            }}
            trackColor={{ false: THEME.colors.text.muted, true: THEME.colors.accent.cyan }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Streaming responses</Text>
          <Switch
            value={streamingEnabled}
            onValueChange={(v) => {
              void getSettingsStore().getState().setStreamingEnabled(v);
            }}
            trackColor={{ false: THEME.colors.text.muted, true: THEME.colors.accent.cyan }}
          />
        </View>
      </ClawPanel>

      <ClawPanel style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutLine}>Version {Constants.expoConfig?.version ?? '0.1.0'}</Text>
        <Text style={styles.aboutLine}>github.com/AryanSahay1/Nexus</Text>
        <Text style={styles.aboutLine}>Local-first. No data leaves this device.</Text>
      </ClawPanel>

      <ClawPanel tone="danger" style={styles.section}>
        <Text style={styles.dangerTitle}>Danger zone</Text>
        <View style={{ marginTop: THEME.spacing.md }}>
          <GlowButton
            label="Factory reset"
            variant="danger"
            fullWidth
            onPress={handleResetEverything}
          />
        </View>
      </ClawPanel>
    </ScrollView>
  );
};

const SettingsScreen: React.FC = () => (
  <ErrorBoundary screen="settings">
    <SettingsScreenInner />
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
  section: { marginBottom: THEME.spacing.lg },
  sectionTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginBottom: THEME.spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  accountIdentity: {
    flex: 1,
  },
  accountName: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  accountStatusRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
  },
  linkDivider: {
    height: 1,
    backgroundColor: THEME.colors.border.default,
    marginVertical: 2,
  },
  linkLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  linkHint: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 2,
  },
  linkArrow: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.accent.cyan,
    paddingHorizontal: THEME.spacing.sm,
  },
  providerRow: { flexDirection: 'row', gap: THEME.spacing.sm, marginBottom: THEME.spacing.md },
  providerChip: {
    flex: 1,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border.default,
    alignItems: 'center',
  },
  providerChipActive: {
    borderColor: THEME.colors.border.active,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
  },
  providerLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
  },
  providerLabelActive: { color: THEME.colors.accent.cyan },
  fieldLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: THEME.spacing.md,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: THEME.colors.background.elevated,
    borderColor: THEME.colors.border.default,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
  },
  modelRow: {
    paddingVertical: THEME.spacing.sm,
    gap: THEME.spacing.sm,
  },
  modelChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border.default,
    marginRight: THEME.spacing.sm,
  },
  modelChipActive: {
    borderColor: THEME.colors.border.active,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
  },
  modelChipLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.secondary,
  },
  modelChipLabelActive: { color: THEME.colors.accent.cyan },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.lg,
  },
  tempButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.accentFill.cyanStrong,
  },
  tempButtonLabel: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.accent.cyan,
  },
  tempValue: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  tempCaption: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: THEME.spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.sm,
  },
  toggleLabel: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  aboutLine: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.muted,
    marginTop: 2,
  },
  dangerTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.accent.coral,
  },
});

export default SettingsScreen;
