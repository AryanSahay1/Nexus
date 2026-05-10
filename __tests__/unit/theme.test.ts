/**
 * Unit tests for src/theme.
 *
 * The theme is consumed by every component — the constants below MUST
 * remain stable. Anyone changing them needs to update this file too.
 */

jest.mock('react-native-reanimated', () => ({
  Easing: {
    bezier: () => () => 0,
    inOut: () => 0,
    ease: 0,
  },
}));

// eslint-disable-next-line import/first
import {
  ANIMATION,
  CLAW_CORNER,
  COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  HIT_SLOP,
  LINE_HEIGHTS,
  RADIUS,
  SHADOWS,
  SPACING,
  THEME,
} from '../../src/theme';

describe('theme — color invariants', () => {
  it('background layers are valid 6-digit hex', () => {
    expect(COLORS.background.primary).toMatch(/^#[0-9A-F]{6}$/i);
    expect(COLORS.background.surface).toMatch(/^#[0-9A-F]{6}$/i);
    expect(COLORS.background.elevated).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('cyan accent matches the canonical electric cyan', () => {
    expect(COLORS.accent.cyan).toBe('#00F5D4');
  });

  it('coral accent matches the canonical neon coral', () => {
    expect(COLORS.accent.coral).toBe('#FF4757');
  });

  it('text.primary is the slightly-blue-white, not pure white', () => {
    expect(COLORS.text.primary).toBe('#F0F0F5');
    expect(COLORS.text.primary).not.toBe('#FFFFFF');
  });

  it('border layers progressively increase opacity', () => {
    const opacityFromRgba = (rgba: string): number => {
      const m = /,\s*([0-9.]+)\)$/.exec(rgba);
      return m && m[1] !== undefined ? parseFloat(m[1]) : NaN;
    };
    expect(opacityFromRgba(COLORS.border.default)).toBeLessThan(opacityFromRgba(COLORS.border.hover));
    expect(opacityFromRgba(COLORS.border.hover)).toBeLessThan(opacityFromRgba(COLORS.border.active));
  });
});

describe('theme — typography', () => {
  it('font family names match @expo-google-fonts exports', () => {
    expect(FONT_FAMILIES.display).toBe('Syne_800ExtraBold');
    expect(FONT_FAMILIES.body).toBe('Outfit_400Regular');
    expect(FONT_FAMILIES.mono).toBe('JetBrainsMono_400Regular');
  });

  it('font scale covers all the documented sizes', () => {
    expect(FONT_SIZES.xs).toBe(11);
    expect(FONT_SIZES.sm).toBe(13);
    expect(FONT_SIZES.md).toBe(15);
    expect(FONT_SIZES.lg).toBe(17);
    expect(FONT_SIZES.xl).toBe(20);
    expect(FONT_SIZES.xxl).toBe(26);
    expect(FONT_SIZES.display).toBe(34);
  });

  it('line heights match the design system', () => {
    expect(LINE_HEIGHTS.display).toBeCloseTo(1.3);
    expect(LINE_HEIGHTS.body).toBeCloseTo(1.5);
    expect(LINE_HEIGHTS.mono).toBeCloseTo(1.2);
  });
});

describe('theme — spacing, radius, claw, animation, shadows', () => {
  it('spacing scale is 4-multiple-monotonic', () => {
    expect(SPACING.xs).toBe(4);
    expect(SPACING.sm).toBe(8);
    expect(SPACING.md).toBe(12);
    expect(SPACING.lg).toBe(16);
    expect(SPACING.xl).toBe(24);
    expect(SPACING.xxl).toBe(32);
  });

  it('claw geometry matches the documented values', () => {
    expect(CLAW_CORNER.size).toBe(10);
    expect(CLAW_CORNER.rotationDeg).toBe(45);
  });

  it('radius pill is large enough to fully round any reasonable height', () => {
    expect(RADIUS.pill).toBeGreaterThan(100);
  });

  it('animation timing follows the fast-in / slow-out philosophy', () => {
    expect(ANIMATION.fastIn).toBe(150);
    expect(ANIMATION.slowOut).toBe(300);
    expect(ANIMATION.spring.damping).toBe(18);
    expect(ANIMATION.spring.stiffness).toBe(200);
  });

  it('hit slop is at least 8px on every side for thumb reach', () => {
    expect(HIT_SLOP.top).toBeGreaterThanOrEqual(8);
    expect(HIT_SLOP.right).toBeGreaterThanOrEqual(8);
    expect(HIT_SLOP.bottom).toBeGreaterThanOrEqual(8);
    expect(HIT_SLOP.left).toBeGreaterThanOrEqual(8);
  });

  it('SHADOWS.glow uses the cyan accent color', () => {
    expect(SHADOWS.glow.shadowColor).toBe('#00F5D4');
  });
});

describe('theme — aggregate THEME export', () => {
  it('THEME re-exports every section by reference', () => {
    expect(THEME.colors).toBe(COLORS);
    expect(THEME.fonts).toBe(FONT_FAMILIES);
    expect(THEME.fontSizes).toBe(FONT_SIZES);
    expect(THEME.spacing).toBe(SPACING);
    expect(THEME.radius).toBe(RADIUS);
    expect(THEME.claw).toBe(CLAW_CORNER);
    expect(THEME.animation).toBe(ANIMATION);
  });
});
