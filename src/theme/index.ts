/**
 * Project Nexus — design system.
 *
 * Tactile industrial dark UI. Sharp angles, dense information, cyan glow.
 * Every constant in this file is the single source of truth for colors,
 * spacing, typography, shadows, and animation timing — components and
 * screens MUST read from here, never inline a hex code or px value.
 */

import { Easing } from 'react-native-reanimated';

// ── Colors ----------------------------------------------------------------

export const COLORS = {
  /** Background layers, darkest → lightest. */
  background: {
    /** Base canvas. */
    primary: '#0A0A0F',
    /** Cards and panels. */
    surface: '#111118',
    /** Modals, popovers, bottom sheets. */
    elevated: '#16161F',
    /** Code-block background. */
    code: '#0D1117',
  },

  /** rgba border colors layered on top of backgrounds. */
  border: {
    default: 'rgba(0, 245, 212, 0.12)',
    hover: 'rgba(0, 245, 212, 0.35)',
    active: 'rgba(0, 245, 212, 0.65)',
    danger: 'rgba(255, 71, 87, 0.35)',
    warning: 'rgba(255, 184, 48, 0.35)',
    memory: 'rgba(139, 92, 246, 0.35)',
  },

  /** Accent palette. */
  accent: {
    /** Electric cyan — primary actions, AI/system, the signature glow. */
    cyan: '#00F5D4',
    /** Phosphor amber — user elements, warnings, highlights. */
    amber: '#FFB830',
    /** Neon coral — errors, destructive actions. */
    coral: '#FF4757',
    /** Deep purple — memory and storage. */
    purple: '#8B5CF6',
    /** Success green — connected status. */
    green: '#10B981',
  },

  /** Translucent accent fills used as background tints. */
  accentFill: {
    cyan: 'rgba(0, 245, 212, 0.06)',
    cyanStrong: 'rgba(0, 245, 212, 0.12)',
    amber: 'rgba(255, 184, 48, 0.08)',
    amberStrong: 'rgba(255, 184, 48, 0.12)',
    coral: 'rgba(255, 71, 87, 0.08)',
    coralStrong: 'rgba(255, 71, 87, 0.12)',
    purple: 'rgba(139, 92, 246, 0.08)',
    purpleStrong: 'rgba(139, 92, 246, 0.12)',
  },

  /** Text hierarchy. */
  text: {
    /** Slightly blue-white, NEVER pure white. */
    primary: '#F0F0F5',
    secondary: '#8888A0',
    muted: '#44445A',
    accent: '#00F5D4',
    onAccent: '#0A0A0F',
    danger: '#FF4757',
    warning: '#FFB830',
  },
} as const;

// ── Typography ------------------------------------------------------------

/**
 * Font family names exactly as exported by @expo-google-fonts/* packages.
 * Loaded via useFonts() in the root layout. If a font is not yet loaded
 * the platform default is used; consumers should never branch on font
 * availability.
 */
export const FONT_FAMILIES = {
  display: 'Syne_800ExtraBold',
  displayBold: 'Syne_700Bold',
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemibold: 'Outfit_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
} as const;

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 34,
} as const;

export const LINE_HEIGHTS = {
  display: 1.3,
  body: 1.5,
  mono: 1.2,
} as const;

// ── Spacing + radius ------------------------------------------------------

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// ── Shadows / glow --------------------------------------------------------

export const SHADOWS = {
  glow: {
    shadowColor: COLORS.accent.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  panel: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

// ── Claw corner geometry --------------------------------------------------

/**
 * The signature design detail. Each panel renders four ten-by-ten View
 * pieces rotated 45 degrees, colored to match the parent background, in
 * each corner — producing a chamfered corner without resorting to
 * clip-path which performs poorly on Android RN.
 */
export const CLAW_CORNER = {
  size: 10,
  rotationDeg: 45,
} as const;

// ── Animation -------------------------------------------------------------

export const ANIMATION = {
  fastIn: 150,
  slowOut: 300,
  // Reanimated easing curve used for most fade / slide transitions.
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  // Spring config for press / scale interactions.
  spring: { damping: 18, stiffness: 200 },
  // Pulse for "glowing" panel borders.
  glowDurationMs: 2000,
  glowMinOpacity: 0.3,
  glowMaxOpacity: 0.8,
  // Typing indicator dot timing.
  typingDotMs: 400,
  typingDotStaggerMs: 150,
} as const;

// ── Hit slop --------------------------------------------------------------

/** Apply to every icon-only Pressable so thumb taps don't miss. */
export const HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;

// ── Aggregate THEME export -----------------------------------------------

export const THEME = {
  colors: COLORS,
  fonts: FONT_FAMILIES,
  fontSizes: FONT_SIZES,
  lineHeights: LINE_HEIGHTS,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  claw: CLAW_CORNER,
  animation: ANIMATION,
  hitSlop: HIT_SLOP,
} as const;

export type Theme = typeof THEME;
