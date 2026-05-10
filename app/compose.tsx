/**
 * Compose — write a new email and send via Gmail.
 *
 * Reachable from the Mail tab header. Uses the same gmailServiceProxy
 * the agent's gmail_send_email tool consumes. A confirmation Alert
 * surfaces before actually firing the API call (LAW 4 — destructive
 * actions always require explicit user consent).
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClawPanel } from '../src/components/shared/ClawPanel';
import { ErrorBoundary } from '../src/components/shared/ErrorBoundary';
import { GlowButton } from '../src/components/shared/GlowButton';
import { useAuth } from '../src/hooks/useAuth';
import * as gmail from '../src/services/gmailServiceProxy';
import { THEME } from '../src/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ComposeInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { googleConnected } = useAuth();

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend =
    EMAIL_REGEX.test(to.trim()) && subject.trim().length > 0 && body.length > 0;

  const handleSend = useCallback(() => {
    if (!canSend || sending) return;
    Alert.alert(
      'Send this email?',
      `To: ${to.trim()}\nSubject: ${subject.trim() || '(no subject)'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            setSending(true);
            setError(null);
            void (async () => {
              const result = await gmail.sendGmailMessage({
                to: to.trim(),
                subject: subject.trim(),
                body,
              });
              setSending(false);
              if (!result.ok) {
                setError(`${result.error.code}: ${result.error.message}`);
                return;
              }
              router.back();
            })();
          },
        },
      ],
    );
  }, [canSend, sending, to, subject, body, router]);

  if (!googleConnected) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + THEME.spacing.lg }]}>
        <Text style={styles.heading}>Compose</Text>
        <ClawPanel style={styles.disconnectedPanel}>
          <Text style={styles.disconnectedTitle}>Google not connected</Text>
          <Text style={styles.disconnectedBody}>
            Compose needs Google connected. Open Vault from Settings to
            connect.
          </Text>
          <View style={{ marginTop: THEME.spacing.md }}>
            <GlowButton
              label="Close"
              variant="ghost"
              fullWidth
              onPress={() => router.back()}
            />
          </View>
        </ClawPanel>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + THEME.spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel compose"
            hitSlop={THEME.hitSlop}
            style={styles.backButton}
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.heading}>Compose</Text>
        </View>

        <ClawPanel style={styles.formPanel}>
          <Text style={styles.fieldLabel}>To</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="someone@example.com"
            placeholderTextColor={THEME.colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.singleLine}
          />
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={THEME.colors.text.muted}
            style={styles.singleLine}
          />
          <Text style={styles.fieldLabel}>Message</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write your email…"
            placeholderTextColor={THEME.colors.text.muted}
            multiline
            style={styles.multiline}
          />
          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ marginTop: THEME.spacing.lg }}>
            <GlowButton
              label="Send email"
              variant="primary"
              fullWidth
              loading={sending}
              disabled={!canSend}
              onPress={handleSend}
            />
          </View>
        </ClawPanel>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const ComposeScreen: React.FC = () => (
  <ErrorBoundary screen="compose">
    <ComposeInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  content: { padding: THEME.spacing.lg, paddingBottom: THEME.spacing.xxxl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.lg,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: THEME.fontSizes.xxl,
    color: THEME.colors.accent.cyan,
    lineHeight: THEME.fontSizes.xxl,
  },
  heading: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xxl,
    color: THEME.colors.text.primary,
    letterSpacing: 2,
  },
  formPanel: { marginTop: THEME.spacing.md },
  fieldLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: THEME.spacing.md,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  singleLine: {
    backgroundColor: THEME.colors.background.elevated,
    borderColor: THEME.colors.border.default,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  multiline: {
    backgroundColor: THEME.colors.background.elevated,
    borderColor: THEME.colors.border.default,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: THEME.spacing.md,
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.danger,
  },
  disconnectedPanel: { marginHorizontal: THEME.spacing.lg, marginTop: THEME.spacing.lg },
  disconnectedTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  disconnectedBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
});

export default ComposeScreen;
