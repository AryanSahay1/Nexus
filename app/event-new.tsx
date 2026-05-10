/**
 * Event-new — create a Google Calendar event from the Calendar tab.
 *
 * Reachable from the Calendar tab header. Inputs: summary, start
 * datetime, duration in minutes, optional description. The form
 * validates ISO 8601 + end > start before submitting; on success the
 * router pops back to the Calendar tab where the new event will
 * appear on the next refresh.
 *
 * LAW 4 — confirmation Alert before the API call.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { useCalendar } from '../src/hooks/useCalendar';
import { THEME } from '../src/theme';

const DURATION_PRESETS: readonly number[] = [15, 30, 60, 90];

const startOfNextHour = (): Date => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

const formatLocalForInput = (d: Date): string => {
  // YYYY-MM-DDTHH:MM in local time, the format <TextInput> users typically
  // type. We do NOT use the browser-native datetime-local because RN does
  // not have one — TextInput is the cross-platform choice.
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const parseLocalDatetime = (value: string): Date | null => {
  // Accept either "YYYY-MM-DDTHH:MM" or full ISO 8601. Returns null on
  // any parse failure.
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const candidate = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const inferTimezone = (): string => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
};

const EventNewInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { googleConnected } = useAuth();
  const calendar = useCalendar();

  const [summary, setSummary] = useState('');
  const [startInput, setStartInput] = useState(formatLocalForInput(startOfNextHour()));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = useMemo(() => parseLocalDatetime(startInput), [startInput]);
  const canSubmit =
    summary.trim().length > 0 && startDate !== null && durationMinutes > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || submitting || startDate === null) return;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    Alert.alert(
      'Create this event?',
      `${summary.trim()}\n${startDate.toLocaleString()} — ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => {
            setSubmitting(true);
            setError(null);
            void (async () => {
              const result = await calendar.createEvent({
                summary: summary.trim(),
                startIso: startDate.toISOString(),
                endIso: endDate.toISOString(),
                timezone: inferTimezone(),
                ...(description.trim().length > 0 ? { description: description.trim() } : {}),
              });
              setSubmitting(false);
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
  }, [canSubmit, submitting, summary, startDate, durationMinutes, description, calendar, router]);

  if (!googleConnected) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + THEME.spacing.lg }]}>
        <Text style={styles.heading}>New event</Text>
        <ClawPanel style={styles.disconnectedPanel}>
          <Text style={styles.disconnectedTitle}>Google not connected</Text>
          <Text style={styles.disconnectedBody}>
            New event needs Google connected. Open Vault from Settings to
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
            accessibilityLabel="Cancel new event"
            hitSlop={THEME.hitSlop}
            style={styles.backButton}
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.heading}>New event</Text>
        </View>

        <ClawPanel style={styles.formPanel}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Sync with Sarah"
            placeholderTextColor={THEME.colors.text.muted}
            style={styles.singleLine}
          />

          <Text style={styles.fieldLabel}>Start</Text>
          <TextInput
            value={startInput}
            onChangeText={setStartInput}
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor={THEME.colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.singleLine, styles.mono]}
          />
          <Text style={styles.fieldHint}>
            Local time, format YYYY-MM-DDTHH:MM. Timezone {inferTimezone()}.
          </Text>

          <Text style={styles.fieldLabel}>Duration</Text>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((m) => {
              const active = m === durationMinutes;
              return (
                <Pressable
                  key={m}
                  onPress={() => setDurationMinutes(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {m} min
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Agenda, notes, links…"
            placeholderTextColor={THEME.colors.text.muted}
            multiline
            style={styles.multiline}
          />

          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ marginTop: THEME.spacing.lg }}>
            <GlowButton
              label="Create event"
              variant="primary"
              fullWidth
              loading={submitting}
              disabled={!canSubmit}
              onPress={handleSubmit}
            />
          </View>
        </ClawPanel>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const EventNewScreen: React.FC = () => (
  <ErrorBoundary screen="event_new">
    <EventNewInner />
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
  fieldHint: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 4,
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
  mono: { fontFamily: THEME.fonts.mono, fontSize: THEME.fontSizes.sm },
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  chip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border.default,
  },
  chipActive: {
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    borderColor: THEME.colors.border.active,
  },
  chipLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
  },
  chipLabelActive: { color: THEME.colors.accent.cyan, fontFamily: THEME.fonts.bodyMedium },
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

export default EventNewScreen;
