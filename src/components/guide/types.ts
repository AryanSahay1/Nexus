/**
 * Public types for the guided tour subsystem.
 *
 * The two surfaces consumers interact with:
 *   - `TourStep`        — the description of one step in a tour. The
 *                         `targetRef` points at the actual UI element to
 *                         spotlight; `useTour` measures it via the native
 *                         `measure()` call to compute screen coordinates.
 *   - `TourId`          — the canonical identifier persisted under
 *                         `tour_completed_<id>` in user_preferences. We
 *                         use a string union so a typo at the call site
 *                         is a compile error, not a runtime mystery.
 *
 * Why a string union instead of `string`?
 * Tours are referenced from many call sites (every screen + the Settings
 * "Restart guided tours" affordance). A typo silently means "this user
 * never completed the tour", which would re-show the overlay forever.
 * The compiler catches every typo this way.
 */

import type { RefObject } from 'react';
import type { View } from 'react-native';

export type TourId =
  | 'vault_openai_setup'
  | 'vault_google_connect'
  | 'chat_first_message'
  | 'chat_confirm_action'
  | 'mail_first_open'
  | 'mail_send_via_agent'
  | 'calendar_first_open'
  | 'calendar_create_via_agent'
  | 'memory_first_open'
  | 'settings_first_open'
  | 'voice_first_use';

/** All known tour ids — used by the registry helper to wipe completion. */
export const ALL_TOUR_IDS: readonly TourId[] = [
  'vault_openai_setup',
  'vault_google_connect',
  'chat_first_message',
  'chat_confirm_action',
  'mail_first_open',
  'mail_send_via_agent',
  'calendar_first_open',
  'calendar_create_via_agent',
  'memory_first_open',
  'settings_first_open',
  'voice_first_use',
];

export type SpotlightShape = 'rect' | 'circle';
export type TooltipPosition = 'above' | 'below' | 'auto';

export interface TourStep {
  /** A ref to the View / Pressable / TextInput we want to spotlight. */
  readonly targetRef: RefObject<View | null>;
  readonly title: string;
  readonly description: string;
  readonly actionHint: string;
  readonly spotlightShape?: SpotlightShape;
  readonly tooltipPosition?: TooltipPosition;
}

/**
 * Measured rectangle for the spotlight target — output of
 * `View.measure()` mapped to screen coordinates.
 */
export interface MeasuredRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Canonical key used by preferencesStore to remember completion. */
export const completionKey = (tourId: TourId): string => `tour_completed_${tourId}`;
