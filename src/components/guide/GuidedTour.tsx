/**
 * GuidedTour — the visual overlay for one running tour.
 *
 * Layout (from bottom of stack to top):
 *   1. Four <View> dim layers (top / left / right / bottom) around the
 *      spotlight target. Combined alpha ~0.55 — dark enough to focus
 *      attention, light enough to keep the underlying UI legible.
 *   2. A `<View>` with a soft cyan border + reanimated pulse. This sits
 *      OVER the cutout but is `pointerEvents="none"` so the user's tap
 *      lands on the underlying button.
 *   3. The tooltip card (ClawPanel) positioned by `placeTooltip`.
 *
 * Tap handling:
 *   - The dim rectangles are pressable but consume the tap silently —
 *     this is the "tapping outside the cutout does nothing" rule.
 *   - The cutout area is empty, so taps fall through to the underlying
 *     UI; we additionally observe step completion via the explicit
 *     "Got it / Next / Done" button on the tooltip.
 */

import React, { useEffect } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ClawPanel } from '../shared/ClawPanel';
import { GlowButton } from '../shared/GlowButton';
import { THEME } from '../../theme';
import { computeDimRects, placeTooltip } from './tourPosition';
import type { MeasuredRect, TourStep } from './types';

const TOOLTIP_HEIGHT_ESTIMATE = 220;
const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 16;
const TOOLTIP_SAFE_PADDING = 16;

export interface GuidedTourProps {
  readonly step: TourStep;
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly targetRect: MeasuredRect | null;
  readonly onAdvance: () => void;
  readonly onSkip: () => void;
}

/** Pure visual layer. State + measurement live in `useTour`. */
const GuidedTourImpl: React.FC<GuidedTourProps> = ({
  step,
  stepIndex,
  stepCount,
  targetRect,
  onAdvance,
  onSkip,
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return (): void => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.85 + (pulse.value - 1) * 2,
  }));

  // If we couldn't measure the target, render a centred fullscreen
  // tooltip — better than crashing or rendering an invisible overlay.
  if (targetRect === null) {
    return (
      <View
        style={styles.fullscreenDim}
        pointerEvents="auto"
        accessibilityViewIsModal
        testID="guided-tour-fallback"
      >
        <View style={styles.tooltipFloat}>
          <Tooltip
            step={step}
            stepIndex={stepIndex}
            stepCount={stepCount}
            onAdvance={onAdvance}
            onSkip={onSkip}
          />
        </View>
      </View>
    );
  }

  const padded: MeasuredRect = {
    x: targetRect.x - SPOTLIGHT_PADDING,
    y: targetRect.y - SPOTLIGHT_PADDING,
    width: targetRect.width + SPOTLIGHT_PADDING * 2,
    height: targetRect.height + SPOTLIGHT_PADDING * 2,
  };

  const dim = computeDimRects(padded, screenWidth, screenHeight);
  const placement = placeTooltip(padded, TOOLTIP_HEIGHT_ESTIMATE, screenWidth, screenHeight, {
    requested: step.tooltipPosition ?? 'auto',
    safePadding: TOOLTIP_SAFE_PADDING,
    gap: TOOLTIP_GAP,
  });

  const isCircle = step.spotlightShape === 'circle';
  const cutoutRadius = isCircle
    ? Math.max(padded.width, padded.height) / 2
    : THEME.radius.md;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      accessibilityViewIsModal
      testID="guided-tour-root"
    >
      <DimRect rect={dim.top} testID="tour-dim-top" />
      <DimRect rect={dim.left} testID="tour-dim-left" />
      <DimRect rect={dim.right} testID="tour-dim-right" />
      <DimRect rect={dim.bottom} testID="tour-dim-bottom" />

      <Animated.View
        pointerEvents="none"
        testID="tour-spotlight-ring"
        style={[
          styles.spotlightRing,
          {
            left: padded.x,
            top: padded.y,
            width: padded.width,
            height: padded.height,
            borderRadius: cutoutRadius,
          },
          pulseStyle,
        ]}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.tooltipFloat,
          {
            left: placement.x,
            top: placement.y,
            width: placement.width,
          },
        ]}
      >
        <Tooltip
          step={step}
          stepIndex={stepIndex}
          stepCount={stepCount}
          onAdvance={onAdvance}
          onSkip={onSkip}
        />
      </View>
    </View>
  );
};

interface DimRectProps {
  readonly rect: MeasuredRect;
  readonly testID: string;
}
const DimRect: React.FC<DimRectProps> = ({ rect, testID }) => (
  <Pressable
    testID={testID}
    onPress={() => undefined /* intentional swallow — see header */}
    style={[
      styles.dim,
      { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
    ]}
  />
);

interface TooltipProps {
  readonly step: TourStep;
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly onAdvance: () => void;
  readonly onSkip: () => void;
}
const Tooltip: React.FC<TooltipProps> = ({
  step,
  stepIndex,
  stepCount,
  onAdvance,
  onSkip,
}) => {
  const isLast = stepIndex === stepCount - 1;
  const advanceLabel = isLast ? "Let's go!" : stepIndex === 0 ? 'Got it' : 'Next';
  return (
    <ClawPanel testID="tour-tooltip">
      <Text style={styles.stepCounter} testID="tour-step-counter">
        Step {stepIndex + 1} of {stepCount}
      </Text>
      <Text style={styles.title} testID="tour-title">
        {step.title}
      </Text>
      <Text style={styles.description} testID="tour-description">
        {step.description}
      </Text>
      <Text style={styles.actionHint} testID="tour-action-hint">
        {step.actionHint}
      </Text>
      <View style={styles.actions}>
        <GlowButton
          label={advanceLabel}
          variant="primary"
          onPress={onAdvance}
          testID="tour-advance-button"
        />
        <Pressable
          onPress={onSkip}
          hitSlop={THEME.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Skip tour"
          testID="tour-skip-button"
        >
          <Text style={styles.skipLink}>Skip tour</Text>
        </Pressable>
      </View>
    </ClawPanel>
  );
};

const styles = StyleSheet.create({
  fullscreenDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 12, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(8, 12, 20, 0.55)',
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: THEME.colors.accent.cyan,
    backgroundColor: 'transparent',
    shadowColor: THEME.colors.accent.cyan,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  tooltipFloat: {
    position: 'absolute',
  },
  stepCounter: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontFamily: THEME.fonts.displayBold,
    fontSize: THEME.fontSizes.lg,
    color: THEME.colors.text.primary,
    marginBottom: 6,
  },
  description: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.md,
    color: THEME.colors.text.secondary,
    marginBottom: 8,
    lineHeight: THEME.fontSizes.md * THEME.lineHeights.body,
  },
  actionHint: {
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: THEME.fontSizes.sm,
    color: THEME.colors.accent.cyan,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.md,
  },
  skipLink: {
    fontFamily: THEME.fonts.body,
    fontSize: THEME.fontSizes.xs,
    color: THEME.colors.text.muted,
    textDecorationLine: 'underline',
  },
});

export const GuidedTour = React.memo(GuidedTourImpl);
GuidedTour.displayName = 'GuidedTour';

export default GuidedTour;
