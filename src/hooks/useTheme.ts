/**
 * useTheme — typed accessor for the design-system constants.
 *
 * The THEME object itself is immutable and imported directly from
 * `src/theme`. This hook exists for the master-spec parity reason and
 * to centralize a single import path across screens that previously
 * imported `THEME` directly. Future dynamic-theme work (e.g. a
 * runtime light/dark toggle) extends the hook without churning every
 * call site.
 */

import { THEME, type Theme } from '../theme';

export const useTheme = (): Theme => THEME;
