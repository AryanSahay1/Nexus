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

import { ClawPanel } from '../../src/components/shared/ClawPanel';
import { EmptyState } from '../../src/components/shared/EmptyState';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import { GlowButton } from '../../src/components/shared/GlowButton';
import { LoadingSpinner } from '../../src/components/shared/LoadingSpinner';
import { useAuth } from '../../src/hooks/useAuth';
import { useCalendar, type RangeKey } from '../../src/hooks/useCalendar';
import * as notificationService from '../../src/services/notificationService';
import { THEME } from '../../src/theme';
import { type CalendarEvent } from '../../src/types/tools';

const RANGES: readonly { readonly id: RangeKey; readonly label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'two_weeks', label: '2 weeks' },
];

// Range computation now lives inside `useCalendar` — the screen
// only consumes the resolved RangeKey and does not need to translate
// it into ISO timestamps itself.

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
  const { googleConnected } = useAuth();
  const calendar = useCalendar('week');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (googleConnected) {
      void calendar.load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected, calendar.range]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      await calendar.refresh();
      setRefreshing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => groupByDay(calendar.events), [calendar.events]);
  const loading =
    calendar.status === 'loading_cache' || calendar.status === 'loading_network';
  const errorText =
    calendar.error ? `${calendar.error.code}: ${calendar.error.message}` : null;

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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>CALENDAR</Text>
          <Text style={styles.subheading}>
            Long-press an event to schedule a reminder.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New event"
          onPress={() => router.push('/event-new')}
          hitSlop={THEME.hitSlop}
          style={styles.newEventButton}
        >
          <Text style={styles.newEventGlyph}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = r.id === calendar.range;
          return (
            <Pressable
              key={r.id}
              onPress={() => calendar.setRange(r.id)}
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
            </Pressable>
          );
        })}
      </View>

      {errorText !== null ? (
        <ClawPanel tone="danger" style={styles.errorPanel}>
          <Text style={styles.errorText}>{errorText}</Text>
        </ClawPanel>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <LoadingSpinner label="Loading calendar…" />
        </View>
      ) : grouped.length === 0 ? (
        <EmptyState
          glyph="📅"
          title="No upcoming events"
          body="Pull down to refresh, or change the range above."
        />
      ) : (
        <FlashList
          data={grouped as { readonly dayKey: string; readonly events: readonly CalendarEvent[] }[]}
          keyExtractor={(item) => item.dayKey}
          estimatedItemSize={140}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.dayBlock}>
              <Text style={styles.dayLabel}>{item.dayKey}</Text>
              {item.events.map((e) => (
                <EventRow key={e.id} event={e} onLongPress={handleScheduleReminder} />
              ))}
            </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: THEME.spacing.lg,
  },
  newEventButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border.active,
    backgroundColor: THEME.colors.accentFill.cyanStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newEventGlyph: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.accent.cyan,
    lineHeight: THEME.fontSizes.xl,
  },
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
