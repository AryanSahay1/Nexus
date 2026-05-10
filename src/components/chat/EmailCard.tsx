/**
 * EmailCard — compact email summary row used in the chat thread when the
 * agent surfaces a list of emails.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type EmailThread } from '../../types/google';
import { THEME } from '../../theme';

import { ClawPanel } from '../shared/ClawPanel';
import { StatusPill } from '../shared/StatusPill';

export interface EmailCardProps {
  readonly thread: EmailThread;
  readonly onPress?: (id: string) => void;
  readonly testID?: string;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const EmailCardImpl: React.FC<EmailCardProps> = ({ thread, onPress, testID }) => (
  <Pressable
    onPress={onPress ? () => onPress(thread.id) : undefined}
    accessibilityRole="button"
    accessibilityLabel={`Email from ${thread.from}: ${thread.subject}`}
    testID={testID}
    style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
  >
    <ClawPanel style={styles.card} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.from} numberOfLines={1}>
          {thread.from || 'Unknown sender'}
        </Text>
        <Text style={styles.date}>{formatDate(thread.dateIso)}</Text>
      </View>
      <Text style={styles.subject} numberOfLines={1}>
        {thread.subject || '(no subject)'}
      </Text>
      <Text style={styles.snippet} numberOfLines={2}>
        {thread.snippet}
      </Text>
      {thread.unread ? (
        <View style={styles.pillWrap}>
          <StatusPill label="Unread" tone="info" />
        </View>
      ) : null}
    </ClawPanel>
  </Pressable>
);

const styles = StyleSheet.create({
  card: { marginVertical: THEME.spacing.xs },
  content: { padding: THEME.spacing.md },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  from: {
    fontFamily: THEME.fonts.bodySemibold,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
    flex: 1,
  },
  date: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
  },
  subject: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginTop: 2,
  },
  snippet: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.secondary,
    marginTop: 4,
    lineHeight: THEME.fontSizes.sm * THEME.lineHeights.body,
  },
  pillWrap: {
    marginTop: THEME.spacing.sm,
    flexDirection: 'row',
  },
});

export const EmailCard = React.memo(EmailCardImpl);
EmailCard.displayName = 'EmailCard';

export default EmailCard;
