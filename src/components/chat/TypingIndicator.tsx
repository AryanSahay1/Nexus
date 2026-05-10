/**
 * TypingIndicator — three dots pulsing while the agent is working.
 *
 * The label adapts to the agentStatus passed in:
 *   processing_intent → "Nexus is thinking"
 *   executing_tool    → "Nexus is using <tool>"
 *   requires_action   → "Awaiting confirmation"
 *   any other         → null (renders nothing)
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { type AgentStatus } from '../../types/agent';
import { THEME } from '../../theme';

export interface TypingIndicatorProps {
  readonly status: AgentStatus;
  readonly currentToolName?: string | null;
  readonly testID?: string;
}

const labelFor = (status: AgentStatus, toolName: string | null | undefined): string | null => {
  switch (status) {
    case 'processing_intent':
      return 'Nexus is thinking';
    case 'executing_tool':
      return toolName ? `Nexus is using ${toolName}` : 'Nexus is working';
    case 'requires_action':
      return 'Awaiting your confirmation';
    case 'idle':
    default:
      return null;
  }
};

const Dot: React.FC<{ delay: number }> = ({ delay }) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    const dur = THEME.animation.typingDotMs;
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration: dur, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(scale);
  }, [delay, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.dot, animated]} />;
};

const TypingIndicatorImpl: React.FC<TypingIndicatorProps> = ({
  status,
  currentToolName,
  testID,
}) => {
  const label = labelFor(status, currentToolName);
  if (label === null) return null;
  return (
    <View testID={testID} style={styles.row} accessibilityLiveRegion="polite">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={THEME.animation.typingDotStaggerMs} />
        <Dot delay={THEME.animation.typingDotStaggerMs * 2} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: THEME.colors.accentFill.cyan,
    borderRadius: THEME.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.accent.cyan,
    margin: THEME.spacing.sm,
  },
  label: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.text.primary,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.accent.cyan,
  },
});

export const TypingIndicator = React.memo(TypingIndicatorImpl);
TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
