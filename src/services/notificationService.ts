/**
 * Notification service — TEMPORARILY STUBBED in v1.0.2.
 *
 * v1.0.0 added expo-notifications. v1.0.0 / v1.0.1 both close
 * immediately on the user's Vivo V27. v1.0.2 is the controlled
 * experiment: same source as v1.0.1 EXCEPT expo-notifications is
 * removed entirely (both the dependency from package.json and any
 * import that would trigger native autolinking).
 *
 * If v1.0.2 opens on Vivo V27 and v1.0.1 does not, expo-notifications
 * was the cause and we ship a v1.0.3 that adds it back via a
 * config-plugin-controlled-and-tested path. If v1.0.2 still does not
 * open, expo-notifications is eliminated as the cause and we move on.
 *
 * The function signatures are preserved so the rest of the app
 * (Calendar screen long-press → schedule reminder) compiles unchanged
 * — but every call resolves with a typed "feature unavailable" Err.
 */

import { type CalendarEvent } from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';
import { logEvent } from '../utils/logger';

const FEATURE_UNAVAILABLE = (): NexusError =>
  new NexusError(
    'PROVIDER_ERROR',
    'Notifications are temporarily disabled in this build (v1.0.2 diagnostic).',
    { isRetryable: false },
  );

export const requestPermission = async (): Promise<Result<boolean, NexusError>> => {
  logEvent('notifications_disabled_v102', {});
  return ok(false);
};

export const scheduleEventReminder = async (
  _event: CalendarEvent,
  _leadMinutes: number = 15,
): Promise<Result<string, NexusError>> => err(FEATURE_UNAVAILABLE());

export const cancelReminder = async (
  _notificationId: string,
): Promise<Result<void, NexusError>> => err(FEATURE_UNAVAILABLE());

export const cancelAllReminders = async (): Promise<Result<void, NexusError>> =>
  err(FEATURE_UNAVAILABLE());

export const listScheduled = async (): Promise<Result<string[], NexusError>> => ok([]);
