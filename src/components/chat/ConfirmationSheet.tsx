/**
 * ConfirmationSheet — bottom-sheet modal for destructive-action confirmation.
 *
 * Drives the confirmation gate from the agent loop. The backdrop is
 * dimmed and tapping it triggers cancellation; the sheet itself never
 * dismisses without an explicit Confirm or Cancel.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, FadeIn } from 'react-native-reanimated';

import { THEME } from '../../theme';
import { type PendingAction } from '../../types/agent';

import { ClawPanel } from '../shared/ClawPanel';
import { GlowButton } from '../shared/GlowButton';

export interface ConfirmationSheetProps {
  readonly pendingAction: PendingAction | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly hapticsEnabled?: boolean;
  readonly testID?: string;
}

const ConfirmationSheetImpl: React.FC<ConfirmationSheetProps> = ({
  pendingAction,
  onConfirm,
  onCancel,
  hapticsEnabled = true,
  testID,
}) => {
  const visible = pendingAction !== null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      testID={testID}
    >
      <Animated.View
        entering={FadeIn.duration(THEME.motion.durations.normal)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Cancel pending action"
          onPress={onCancel}
        >
          <Animated.View
            // Spring-style slide-in — feels heavier than a linear
            // fade, signalling "stop and read this" before the user
            // commits to a destructive action. (skill file §13)
            entering={SlideInDown.springify().damping(22).stiffness(220)}
            style={styles.sheetWrap}
          // Stop propagation so taps on the sheet itself don't dismiss.
          onStartShouldSetResponder={() => true}
        >
          <ClawPanel tone="danger" elevated style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.warningGlyph}>!</Text>
              <Text style={styles.title}>Confirm Action</Text>
            </View>
            <Text style={styles.toolName}>
              {pendingAction?.toolName ?? 'unknown_tool'}
            </Text>
            <Text style={styles.summary}>
              {pendingAction?.displaySummary ?? 'Awaiting details…'}
            </Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonFlex}>
                <GlowButton
                  label="Cancel"
                  variant="ghost"
                  fullWidth
                  hapticsEnabled={hapticsEnabled}
                  onPress={onCancel}
                />
              </View>
              <View style={styles.buttonFlex}>
                <GlowButton
                  label="Confirm"
                  variant="primary"
                  fullWidth
                  hapticsEnabled={hapticsEnabled}
                  onPress={onConfirm}
                />
              </View>
            </View>
          </ClawPanel>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: THEME.spacing.xl,
  },
  sheet: {
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  warningGlyph: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xxl,
    color: THEME.colors.accent.coral,
    lineHeight: THEME.fontSizes.xxl,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: THEME.fontSizes.xl,
    color: THEME.colors.accent.coral,
  },
  toolName: {
    fontFamily: THEME.fonts.mono,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.cyan,
    marginTop: THEME.spacing.sm,
  },
  summary: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.primary,
    marginTop: THEME.spacing.md,
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.xl,
  },
  buttonFlex: {
    flex: 1,
  },
});

export const ConfirmationSheet = React.memo(ConfirmationSheetImpl);
ConfirmationSheet.displayName = 'ConfirmationSheet';

export default ConfirmationSheet;
