/**
 * Unit tests for the guided-tour engine.
 *
 * The visual layer (GuidedTour.tsx + TourProvider.tsx) is verified end
 * to end by Detox in a follow-up. These unit tests pin the headless
 * pieces:
 *
 *   - `tourPosition`            pure geometry — dim-rect math + tooltip
 *                               placement, exhaustive across edge cases.
 *   - `useTour.__internal`      isAlreadyCompleted predicate
 *                               (snapshot lookup).
 *   - `types.completionKey`     stable key naming so a future rename
 *                               can't silently invalidate every user's
 *                               persisted completion flags.
 */

jest.mock('expo-secure-store', () => ({ __esModule: true }));
jest.mock('expo-sqlite', () => ({ __esModule: true }));
jest.mock('expo-sqlite/next', () => ({ __esModule: true }));

import { computeDimRects, placeTooltip } from '../../src/components/guide/tourPosition';
import { __internal as tourInternal } from '../../src/components/guide/useTour';
import {
  ALL_TOUR_IDS,
  completionKey,
  type TourId,
} from '../../src/components/guide/types';

// ── tourPosition: dim rectangles ────────────────────────────────────

describe('computeDimRects — wraps the spotlight with four dim rectangles', () => {
  it('builds top/left/right/bottom rectangles whose union covers the screen except the cutout', () => {
    const screen = { w: 400, h: 800 };
    const spotlight = { x: 80, y: 200, width: 240, height: 60 };
    const dim = computeDimRects(spotlight, screen.w, screen.h);

    expect(dim.top).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(dim.left).toEqual({ x: 0, y: 200, width: 80, height: 60 });
    expect(dim.right).toEqual({ x: 320, y: 200, width: 80, height: 60 });
    expect(dim.bottom).toEqual({ x: 0, y: 260, width: 400, height: 540 });
  });

  it('clamps spotlights that extend past the screen edge', () => {
    const dim = computeDimRects(
      { x: -10, y: -10, width: 1000, height: 1000 },
      400,
      800,
    );
    expect(dim.top.height).toBe(0);
    expect(dim.left.width).toBe(0);
    // Right + bottom collapse because the spotlight overflows the screen.
    expect(dim.right.width).toBe(0);
    expect(dim.bottom.height).toBe(0);
  });

  it('handles a zero-sized spotlight without producing negative widths', () => {
    const dim = computeDimRects({ x: 100, y: 100, width: 0, height: 0 }, 400, 800);
    expect(dim.top.height).toBe(100);
    expect(dim.left.width).toBe(100);
    expect(dim.right.width).toBe(300);
    expect(dim.bottom.height).toBe(700);
  });
});

// ── tourPosition: tooltip placement ─────────────────────────────────

describe('placeTooltip — auto-positions the tooltip without clipping', () => {
  const screen = { w: 400, h: 800 };
  const opts = { requested: 'auto' as const, safePadding: 16, gap: 16 };

  it('places below when the spotlight is near the top', () => {
    const placement = placeTooltip(
      { x: 50, y: 80, width: 300, height: 60 },
      220,
      screen.w,
      screen.h,
      opts,
    );
    expect(placement.placedAt).toBe('below');
    expect(placement.y).toBeGreaterThan(80 + 60);
  });

  it('places above when the spotlight is near the bottom', () => {
    const placement = placeTooltip(
      { x: 50, y: 700, width: 300, height: 60 },
      220,
      screen.w,
      screen.h,
      opts,
    );
    expect(placement.placedAt).toBe('above');
    expect(placement.y + 220).toBeLessThanOrEqual(700);
  });

  it("honours the requested 'above' placement when there's room", () => {
    const placement = placeTooltip(
      { x: 50, y: 600, width: 300, height: 60 },
      200,
      screen.w,
      screen.h,
      { ...opts, requested: 'above' },
    );
    expect(placement.placedAt).toBe('above');
  });

  it("falls back to the opposite side if the requested side doesn't fit", () => {
    // 'above' requested but the spotlight starts at y=20 — no headroom.
    const placement = placeTooltip(
      { x: 50, y: 20, width: 300, height: 60 },
      300,
      screen.w,
      screen.h,
      { ...opts, requested: 'above' },
    );
    expect(placement.placedAt).toBe('below');
  });

  it('clamps the tooltip y to the safe top padding when neither side fits', () => {
    // Tiny screen + huge tooltip — neither side has room. Must still
    // be inside the viewport (y >= safePadding).
    const placement = placeTooltip(
      { x: 50, y: 100, width: 300, height: 60 },
      900,
      400,
      400,
      opts,
    );
    expect(placement.y).toBeGreaterThanOrEqual(opts.safePadding);
  });

  it('always sets a tooltip width that respects safePadding on both sides', () => {
    const placement = placeTooltip(
      { x: 50, y: 200, width: 300, height: 60 },
      200,
      screen.w,
      screen.h,
      opts,
    );
    expect(placement.width).toBe(screen.w - opts.safePadding * 2);
    expect(placement.x).toBe(opts.safePadding);
  });
});

// ── useTour internals: completion lookup ────────────────────────────

describe('useTour.__internal.isAlreadyCompleted', () => {
  it("returns true only when the snapshot has '1' under the canonical key", () => {
    const snapshot: Record<string, string> = {
      tour_completed_chat_first_message: '1',
      tour_completed_mail_first_open: '0', // explicit "not yet"
    };
    expect(tourInternal.isAlreadyCompleted(snapshot, 'chat_first_message')).toBe(true);
    expect(tourInternal.isAlreadyCompleted(snapshot, 'mail_first_open')).toBe(false);
    expect(tourInternal.isAlreadyCompleted(snapshot, 'voice_first_use')).toBe(false);
  });
});

// ── types: completionKey is stable + every TourId is registered ────

describe('completionKey + ALL_TOUR_IDS', () => {
  it('produces a stable, prefixed key shape', () => {
    expect(completionKey('chat_first_message')).toBe('tour_completed_chat_first_message');
  });

  it('every TourId in ALL_TOUR_IDS is unique', () => {
    expect(new Set(ALL_TOUR_IDS).size).toBe(ALL_TOUR_IDS.length);
  });

  it('the registry covers every TourId the codebase actually uses', () => {
    // Compile-time check: this object's keys MUST cover the union, or
    // tsc's `Record<TourId, true>` will complain. Failing this means a
    // tour was added without updating ALL_TOUR_IDS.
    const expected: Record<TourId, true> = {
      vault_openai_setup: true,
      vault_google_connect: true,
      chat_first_message: true,
      chat_confirm_action: true,
      mail_first_open: true,
      mail_send_via_agent: true,
      calendar_first_open: true,
      calendar_create_via_agent: true,
      memory_first_open: true,
      settings_first_open: true,
      voice_first_use: true,
    };
    for (const id of Object.keys(expected) as TourId[]) {
      expect(ALL_TOUR_IDS).toContain(id);
    }
  });
});
