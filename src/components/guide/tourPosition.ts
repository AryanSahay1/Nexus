/**
 * Pure positioning math for the guided-tour overlay.
 *
 * Extracted into its own module so the geometry can be unit-tested
 * without touching React Native's native `measure()` call. The
 * overlay component uses these helpers; they take a measured target
 * rect and the screen dimensions and return the rectangles needed to
 * draw the dim layers + the tooltip.
 */

import type { MeasuredRect, TooltipPosition } from './types';

export interface DimRects {
  readonly top: MeasuredRect;
  readonly left: MeasuredRect;
  readonly right: MeasuredRect;
  readonly bottom: MeasuredRect;
}

/**
 * Given the spotlight target rect, return the four rectangles that
 * dim everything *except* the spotlight. We deliberately use four
 * solid `<View>` rectangles around the cutout instead of a single
 * masked layer — this is the only approach that works reliably across
 * Android + iOS without resorting to native masks. The cutout area
 * itself is empty, so taps on it pass through to the underlying UI
 * (which is the desired interaction model).
 */
export const computeDimRects = (
  spotlight: MeasuredRect,
  screenWidth: number,
  screenHeight: number,
): DimRects => {
  // Clamp to screen so tiny rounding errors at the edges don't draw
  // a 1-px-tall sliver beyond the viewport.
  const sx = Math.max(0, spotlight.x);
  const sy = Math.max(0, spotlight.y);
  const sw = Math.max(0, Math.min(spotlight.width, screenWidth - sx));
  const sh = Math.max(0, Math.min(spotlight.height, screenHeight - sy));

  return {
    top: { x: 0, y: 0, width: screenWidth, height: sy },
    left: { x: 0, y: sy, width: sx, height: sh },
    right: { x: sx + sw, y: sy, width: Math.max(0, screenWidth - (sx + sw)), height: sh },
    bottom: {
      x: 0,
      y: sy + sh,
      width: screenWidth,
      height: Math.max(0, screenHeight - (sy + sh)),
    },
  };
};

export interface TooltipPlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** Where the tooltip ended up relative to the target. Useful for tests + arrows. */
  readonly placedAt: 'above' | 'below';
}

/**
 * Decide where to put the tooltip card so it stays on screen.
 *
 * Strategy:
 *   - If `requested === 'above'` and there's enough headroom, place above.
 *   - If `requested === 'below'` and there's enough footroom, place below.
 *   - `'auto'` picks whichever side has more room.
 *   - Fallback: clamp the tooltip into the viewport even if neither side
 *     has the full requested gap (the overlay still has the dim layer
 *     under it; tooltip overlapping the spotlight is preferable to
 *     clipping off-screen — the user can still read it).
 *
 * `safePadding` is the gap between tooltip and viewport edges. `gap` is
 * the gap between the tooltip and the spotlight target.
 */
export const placeTooltip = (
  spotlight: MeasuredRect,
  tooltipHeight: number,
  screenWidth: number,
  screenHeight: number,
  options: {
    readonly requested: TooltipPosition;
    readonly safePadding: number;
    readonly gap: number;
  },
): TooltipPlacement => {
  const { requested, safePadding, gap } = options;

  const tooltipMaxWidth = Math.max(0, screenWidth - safePadding * 2);
  const tooltipWidth = tooltipMaxWidth;

  const headroom = spotlight.y - safePadding - gap;
  const footroom = screenHeight - (spotlight.y + spotlight.height) - safePadding - gap;

  const fitsAbove = headroom >= tooltipHeight;
  const fitsBelow = footroom >= tooltipHeight;

  let placedAt: 'above' | 'below';
  if (requested === 'above') {
    placedAt = fitsAbove ? 'above' : 'below';
  } else if (requested === 'below') {
    placedAt = fitsBelow ? 'below' : 'above';
  } else {
    placedAt = footroom >= headroom ? 'below' : 'above';
  }

  // `x` always centres the tooltip horizontally with safe padding.
  const x = safePadding;

  // y depends on which side we placed on.
  let y: number;
  if (placedAt === 'above') {
    y = Math.max(safePadding, spotlight.y - gap - tooltipHeight);
  } else {
    y = Math.min(
      screenHeight - safePadding - tooltipHeight,
      spotlight.y + spotlight.height + gap,
    );
    // Clamp to keep at least `safePadding` from the top.
    y = Math.max(safePadding, y);
  }

  return { x, y, width: tooltipWidth, placedAt };
};
