/**
 * motion.test — guards on the motion design tokens.
 *
 * The skill file's §9 / §12 / §22 are explicit about a few invariants:
 *   - UI durations must stay in the 80–700ms window.
 *   - The duration scale is monotonically increasing.
 *   - Stagger delay must cap at maxDelay so 1000-row lists don't
 *     animate for 60s.
 *
 * If any of these guards fire, someone has broken the design system.
 */

jest.mock('react-native-reanimated', () => ({
  Easing: {
    bezier: (a: number, b: number, c: number, d: number) => ({ a, b, c, d }),
  },
}));

import { DURATIONS, EASINGS, SPRINGS, staggerDelayMs } from '../../src/theme/motion';

describe('DURATIONS', () => {
  it('is monotonically increasing across the named scale', () => {
    expect(DURATIONS.instant).toBeLessThan(DURATIONS.fast);
    expect(DURATIONS.fast).toBeLessThan(DURATIONS.normal);
    expect(DURATIONS.normal).toBeLessThan(DURATIONS.moderate);
    expect(DURATIONS.moderate).toBeLessThan(DURATIONS.slow);
    expect(DURATIONS.slow).toBeLessThan(DURATIONS.deliberate);
    expect(DURATIONS.deliberate).toBeLessThan(DURATIONS.expressive);
  });

  it('keeps every non-instant duration inside the 80–700ms UI window', () => {
    const visibleDurations = [
      DURATIONS.fast,
      DURATIONS.normal,
      DURATIONS.moderate,
      DURATIONS.slow,
      DURATIONS.deliberate,
      DURATIONS.expressive,
    ];
    for (const d of visibleDurations) {
      expect(d).toBeGreaterThanOrEqual(80);
      expect(d).toBeLessThanOrEqual(700);
    }
  });
});

describe('EASINGS', () => {
  it('exposes all five named curves', () => {
    expect(EASINGS.out).toBeDefined();
    expect(EASINGS.in).toBeDefined();
    expect(EASINGS.inOut).toBeDefined();
    expect(EASINGS.spring).toBeDefined();
    expect(EASINGS.bounce).toBeDefined();
  });
});

describe('SPRINGS', () => {
  it('exposes a sane damping/stiffness for every preset', () => {
    for (const preset of [SPRINGS.gentle, SPRINGS.snappy, SPRINGS.bouncy, SPRINGS.weighty]) {
      expect(preset.damping).toBeGreaterThan(0);
      expect(preset.stiffness).toBeGreaterThan(0);
    }
  });

  it('snappy is stiffer than gentle (faster settling)', () => {
    expect(SPRINGS.snappy.stiffness).toBeGreaterThan(SPRINGS.gentle.stiffness);
  });

  it('bouncy is less damped than snappy (more overshoot)', () => {
    expect(SPRINGS.bouncy.damping).toBeLessThan(SPRINGS.snappy.damping);
  });
});

describe('staggerDelayMs', () => {
  it('returns 0 for index 0', () => {
    expect(staggerDelayMs(0)).toBe(0);
  });

  it('multiplies by step until the cap', () => {
    expect(staggerDelayMs(1, 60, 360)).toBe(60);
    expect(staggerDelayMs(2, 60, 360)).toBe(120);
    expect(staggerDelayMs(5, 60, 360)).toBe(300);
  });

  it('caps at maxDelay regardless of index', () => {
    expect(staggerDelayMs(100, 60, 360)).toBe(360);
    expect(staggerDelayMs(1000, 60, 360)).toBe(360);
  });

  it('honours custom step and cap parameters', () => {
    expect(staggerDelayMs(3, 100, 1000)).toBe(300);
    expect(staggerDelayMs(50, 100, 1000)).toBe(1000);
  });
});
