/**
 * CalendarEventCard — compact upcoming-event display used in the chat
 * thread when the agent returns calendar results.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type CalendarEvent } from '../../types/tools';
import { THEME } from '../../theme';

import { ClawPanel } from '../shared/ClawPanel';

export interface CalendarEventCardProps {
  readonly event: CalendarEvent;
  readonly onPress?: (id: string) => void;
  readonly testID?: string;
}

const formatRange = (startIso: string, endIso: string): { date: string; range: string } => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { date: 'Unknown date', range: '' };
  }
  const dateStr = start.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { date: dateStr, range: `${startStr}—${endStr}` };
};

const CalendarEventCardImpl: React.FC<CalendarEventCardProps> = ({
  event,
  onPress,
  testID,
}) => {
  const { date, range } = formatRange(event.startIso, event.endIso);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Calendar event ${event.summary} on ${date}`}
      onPress={onPress ? () => onPress(event.id) : undefined}
      testID={testID}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <ClawPanel style={styles.card} contentStyle={styles.content}>
        <View style={styles.dateColumn}>
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.timeText}>{range}</Text>
        </View>
        <View style={styles.bodyColumn}>
          <Text style={styles.title} numberOfLines={2}>
            {event.summary || '(no title)'}
          </Text>
          {event.htmlLink !== null ? (
            <Text style={styles.link} numberOfLines={1}>
              {event.htmlLink}
            </Text>
          ) : null}
        </View>
      </ClawPanel>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { marginVertical: THEME.spacing.xs },
  content: { padding: THEME.spacing.md, flexDirection: 'row', gap: THEME.spacing.md },
  dateColumn: {
    minWidth: 96,
    paddingRight: THEME.spacing.md,
    borderRightWidth: 1,
    borderRightColor: THEME.colors.border.default,
  },
  dateText: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.cyan,
  },
  timeText: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.secondary,
    marginTop: 2,
  },
  bodyColumn: {
    flex: 1,
  },
  title: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
  },
  link: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    marginTop: 4,
  },
});

export const CalendarEventCard = React.memo(CalendarEventCardImpl);
CalendarEventCard.displayName = 'CalendarEventCard';

export default CalendarEventCard;
