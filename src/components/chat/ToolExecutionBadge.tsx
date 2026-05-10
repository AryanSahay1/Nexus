/**
 * ToolExecutionBadge — small in-thread chip that names the running tool.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { THEME } from '../../theme';

export interface ToolExecutionBadgeProps {
  readonly toolName: string | null;
  readonly testID?: string;
}

const labelFor = (name: string | null): string | null => {
  if (name === null || name.length === 0) return null;
  switch (name) {
    case 'gmail_read_recent':
      return 'Fetching from Gmail';
    case 'gmail_send_email':
      return 'Drafting email';
    case 'gmail_search':
      return 'Searching Gmail';
    case 'gmail_read_email':
      return 'Reading email';
    case 'google_calendar_create_event':
      return 'Creating calendar event';
    case 'google_calendar_get_next':
      return 'Reading calendar';
    case 'system_contacts_search':
      return 'Searching contacts';
    case 'drive_list_recent':
      return 'Listing Drive files';
    case 'drive_read_doc':
      return 'Reading document';
    case 'remember_fact':
      return 'Saving memory';
    case 'recall_fact':
      return 'Recalling memory';
    case 'list_memories':
      return 'Listing memories';
    default:
      return `Running ${name}`;
  }
};

const ToolExecutionBadgeImpl: React.FC<ToolExecutionBadgeProps> = ({ toolName, testID }) => {
  const label = labelFor(toolName);
  if (label === null) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(THEME.animation.fastIn)}
      style={styles.wrap}
      testID={testID}
    >
      <View style={styles.gear} />
      <Text style={styles.label}>{label}…</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: THEME.colors.accentFill.purple,
    borderColor: THEME.colors.border.memory,
    borderWidth: 1,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    margin: THEME.spacing.sm,
  },
  gear: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.accent.purple,
  },
  label: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.purple,
  },
});

export const ToolExecutionBadge = React.memo(ToolExecutionBadgeImpl);
ToolExecutionBadge.displayName = 'ToolExecutionBadge';

export default ToolExecutionBadge;
