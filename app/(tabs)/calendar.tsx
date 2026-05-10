/**
 * Calendar screen — Today + upcoming events from the user's primary
 * Google Calendar.
 *
 * Reads through googleService.listCalendarEvents (the same call the
 * agent invokes via google_calendar_get_next). Per LAW 9 (no direct
 * API calls from components), the screen calls the service via
 * useEffect-driven adapters.
 *
 * UX:
 *   - Today / This week / Next week tabs
 *   - Pull to refresh
 *   - Tap an event row to see the details and a Schedule reminder action
 *   - Empty + error states
 */

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { FadeSlideIn, PressableScale, SkeletonShimmer } from '../../src/components/motion';
import * as googleService from '../../src/services/googleService';
import * as notificationService from '../../src/services/notificationService';
import { getVaultStore } from '../../src/store/vaultStore';
import { THEME } from '../../src/theme';
import { type CalendarEvent } from '../../src/types/tools';

type RangeKey = 'today' | 'week' | 'two_weeks';

const RANGES: readonly { readonly id: RangeKey; readonly label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'two_weeks', label: '2 weeks' },
];

const computeRange = (key: RangeKey, now: Date): { min: Date; max: Date } => {
  const min = new Date(now);
  min.setHours(0, 0, 0, 0);
  const max = new Date(now);
  max.setHours(0, 0, 0, 0);
  if (key === 'today') {
    max.setDate(max.getDate() + 1);
  } else if (key === 'week') {
    max.setDate(max.getDate() + 7);
  } else {
    max.setDate(max.getDate() + 14);
  }
  return { min, max };
};

const groupByDay = (
  events: readonly CalendarEvent[],
): readonly { readonly dayKey: string; readonly events: readonly CalendarEvent[] }[] => {
  const buckets = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const start = new Date(e.startIso);
    if (Number.isNaN(start.getTime())) continue;
    const key = start.toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries()).map(([dayKey, evts]) => ({
    dayKey,
    events: evts,
  }));
};

const formatTimeRange = (startIso: string, endIso: string): string => {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const sStr = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const eStr = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${sStr}—${eStr}`;
};

const EventRow: React.FC<{
  event: CalendarEvent;
  onLongPress: (e: CalendarEvent) => void;
}> = React.memo(({ event, onLongPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Event ${event.summary}`}
    accessibilityHint="Long-press to schedule a reminder"
    onLongPress={() => onLongPress(event)}
    delayLongPress={300}
    style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
  >
    <ClawPanel style={styles.row} contentStyle={styles.rowContent}>
      <Text style={styles.rowTime}>{formatTimeRange(event.startIso, event.endIso)}</Text>
      <Text style={styles.rowTitle} numberOfLines={2}>
        {event.summary || '(untitled event)'}
      </Text>
      {event.htmlLink !== null ? (
        <Text style={styles.rowLink} numberOfLines={1}>
          {event.htmlLink}
        </Text>
      ) : null}
    </ClawPanel>
  </Pressable>
));
EventRow.displayName = 'EventRow';

const CalendarScreenInner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const googleConnected = useStore(
    getVaultStore(),
    (s) => s.snapshot.google.status === 'connected',
  );

  const [range, setRange] = useState<RangeKey>('week');
  const [events, setEvents] = useState<readonly CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(
    async (initial: boolean): Promise<void> => {
      if (initial) setLoading(true);
      setError(null);
      const now = new Date();
      const { min, max } = computeRange(range, now);
      const result = await googleService.listCalendarEvents({
        timeMinIso: min.toISOString(),
        timeMaxIso: max.toISOString(),
        limit: 50,
      });
      if (initial) setLoading(false);
      setRefreshing(false);
      if (!result.ok) {
        setError(`${result.error.code}: ${result.error.message}`);
        return;
      }
      setEvents(result.value);
    },
    [range],
  );

  useEffect(() => {
    if (googleConnected) {
      void loadEvents(true);
    }
  }, [googleConnected, loadEvents]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadEvents(false);
  }, [loadEvents]);

  const grouped = useMemo(() => groupByDay(events), [events]);

  const handleScheduleReminder = useCallback((event: CalendarEvent) => {
    Alert.alert(
      'Schedule reminder?',
      `15 minutes before "${event.summary || '(untitled)'}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: () => {
            void (async () => {
              const perm = await notificationService.requestPermission();
              if (!perm.ok) {
                Alert.alert('Permission error', perm.error.message);
                return;
              }
              if (!perm.value) {
                Alert.alert(
                  'Notifications disabled',
                  'Enable notifications for Nexus in Android Settings to receive reminders.',
                );
                return;
              }
              const scheduled = await notificationService.scheduleEventReminder(event, 15);
              if (!scheduled.ok) {
                Alert.alert('Could not schedule', scheduled.error.message);
                return;
              }
              Alert.alert('Reminder set', "We'll notify you 15 minutes before.");
            })();
          },
        },
      ],
    );
  }, []);

  if (!googleConnected) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + THEME.spacing.lg }]}>
        <Text style={styles.heading}>CALENDAR</Text>
        <Text style={styles.subheading}>
          Connect Google to view your calendar.
        </Text>
        <ClawPanel style={styles.ctaPanel}>
          <Text style={styles.ctaTitle}>Google not connected</Text>
          <Text style={styles.ctaBody}>
            Calendar uses your own Google account through OAuth. Events
            never leave your phone except as Google Calendar API calls
            you authorized.
          </Text>
          <View style={{ marginTop: THEME.spacing.md }}>
            <GlowButton
              label="Open Vault"
              variant="primary"
              fullWidth
              onPress={() => router.push('/(tabs)/vault')}
            />
          </View>
        </ClawPanel>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + THEME.spacing.lg }]}>
      <Text style={styles.heading}>CALENDAR</Text>
      <Text style={styles.subheading}>
        Long-press an event to schedule a reminder.
      </Text>

      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = r.id === range;
          return (
            <PressableScale
              key={r.id}
              onPress={() => setRange(r.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
            >
              <Text
                style={[
                  styles.rangeLabel,
                  active && styles.rangeLabelActive,
                ]}
              >
                {r.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {error !== null ? (
        <ClawPanel tone="danger" style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
        </ClawPanel>
      ) : null}

      {loading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={`sk-${i}`} style={styles.skeletonRow}>
              <SkeletonShimmer width={56} height={14} radius={6} />
              <View style={{ height: 8 }} />
              <SkeletonShimmer width="80%" height={20} radius={8} />
              <View style={{ height: 6 }} />
              <SkeletonShimmer width="55%" height={12} radius={6} />
            </View>
          ))}
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptyBody}>
            Pull down to refresh, or change the range above.
          </Text>
        </View>
      ) : (
        <FlashList
          data={grouped as { readonly dayKey: string; readonly events: readonly CalendarEvent[] }[]}
          keyExtractor={(item) => item.dayKey}
          estimatedItemSize={140}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <FadeSlideIn index={index}>
              <View style={styles.dayBlock}>
                <Text style={styles.dayLabel}>{item.dayKey}</Text>
                {item.events.map((e) => (
                  <EventRow key={e.id} event={e} onLongPress={handleScheduleReminder} />
                ))}
              </View>
            </FadeSlideIn>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={THEME.colors.accent.cyan}
              colors={[THEME.colors.accent.cyan]}
            />
          }
        />
      )}
    </View>
  );
};

const CalendarScreen: React.FC = () => (
  <ErrorBoundary screen="calendar">
    <CalendarScreenInner />
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: THEME.colors.background.primary },
  heading: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.display,
    color: THEME.colors.text.primary,
    letterSpacing: 4,
    paddingHorizontal: THEME.spacing.lg,
  },
  subheading: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    paddingHorizontal: THEME.spacing.lg,
    marginTop: 4,
    marginBottom: THEME.spacing.lg,
  },
  rangeRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  rangeChip: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border.default,
  },
  rangeChipActive: {
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    borderColor: THEME.colors.border.active,
  },
  rangeLabel: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
  },
  rangeLabelActive: {
    fontFamily: THEME.fonts.bodyMedium,
    color: THEME.colors.accent.cyan,
  },
  errorPanel: {
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  errorText: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.danger,
  },
  listContent: {
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: THEME.spacing.xxxl,
  },
  dayBlock: { marginBottom: THEME.spacing.lg },
  dayLabel: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.cyan,
    marginBottom: THEME.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: { marginBottom: THEME.spacing.sm },
  rowContent: { padding: THEME.spacing.md },
  rowTime: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
  },
  rowTitle: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginTop: 4,
  },
  rowLink: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 4,
  },
  skeletonList: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  skeletonRow: {
    paddingVertical: THEME.spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.text.primary,
  },
  emptyBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
    textAlign: 'center',
  },
  ctaPanel: {
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  ctaTitle: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  ctaBody: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: THEME.spacing.sm,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
});

export default CalendarScreen;
