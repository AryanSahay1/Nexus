/**
 * Motion design tokens — derived from the UI/UX skill file (§9, §12, §15).
 *
 * The existing `ANIMATION` block in `src/theme/index.ts` is kept for
 * backwards compatibility. New code should prefer the richer surface
 * here: a duration scale (instant → expressive), three eased curves
 * (out / in / spring), and four named spring presets covering every
 * physical interaction in the app.
 *
 * Discipline:
 *   - Animate ONLY `transform` and `opacity` (never width/height/top/left).
 *   - UI durations stay between 80ms and 700ms.
 *   - Micro-interactions ≤ 200ms; complex choreography ≤ 700ms.
 *   - Every animation must have a path that compresses to instant when
 *     the OS reports reduced-motion (handled by `useReduceMotion`).
 */

import { Easing } from 'react-native-reanimated';

/** Six-step duration scale — milliseconds. */
export const DURATIONS = {
  /** No animation — used for reduced-motion fallbacks. */
  instant: 0,
  /** Hover / press tint, color tween. */
  fast: 80,
  /** Icon swap, subtle fade. */
  normal: 150,
  /** Dropdown open, tooltip in/out. */
  moderate: 250,
  /** Modal entry, page-element reveal. */
  slow: 350,
  /** Page transition. */
  deliberate: 500,
  /** Hero reveal, onboarding sequence. */
  expressive: 700,
} as const;

/** Standard cubic-bezier curves matched to the skill file's table. */
export const EASINGS = {
  /** Decelerate-in — almost every UI entrance. */
  out: Easing.bezier(0, 0, 0.2, 1),
  /** Accelerate-out — exits feel snappy. */
  in: Easing.bezier(0.4, 0, 1, 1),
  /** Smooth-both — repositioning. */
  inOut: Easing.bezier(0.4, 0, 0.2, 1),
  /** Slight overshoot — confirmation, success. */
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Big bounce — achievement / celebration. */
  bounce: Easing.bezier(0.68, -0.55, 0.27, 1.55),
} as const;

/**
 * Reanimated `withSpring` configurations. `mass` is omitted to fall back
 * to the engine default (1) — overriding mass changes the perceived
 * weight of the animated object and we already get the look we want
 * from damping + stiffness alone.
 */
export const SPRINGS = {
  /** Default — feels like a lightly damped object. */
  gentle: { damping: 18, stiffness: 200 } as const,
  /** Snappy — buttons, chips, switches. */
  snappy: { damping: 22, stiffness: 320 } as const,
  /** Bouncy — celebration, success markers. */
  bouncy: { damping: 12, stiffness: 220 } as const,
  /** Heavy — bottom sheets, modals. */
  weighty: { damping: 26, stiffness: 180 } as const,
} as const;

/**
 * Stagger schedule for list-item entrances. Returns the delay (ms) for
 * the row at index `i`, capped at `maxDelay` so a 200-row list still
 * finishes its enter animation in a reasonable time.
 */
export const staggerDelayMs = (
  index: number,
  step: number = 60,
  maxDelay: number = 360,
): number => Math.min(index * step, maxDelay);

/** Re-export shape so screens can `import { MOTION } from '../theme'`. */
export const MOTION = {
  durations: DURATIONS,
  easings: EASINGS,
  springs: SPRINGS,
  staggerDelayMs,
} as const;

export type Motion = typeof MOTION;
