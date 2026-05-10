/**
 * Notification service — schedules local-only reminders for upcoming
 * calendar events.
 *
 * "Local only": we never push to a remote service. Notifications fire
 * on the device's own scheduling layer (iOS NSUserNotification, Android
 * AlarmManager). No tokens, no FCM project, no server required.
 *
 * Scheduling model:
 *   - For each event, schedule one notification at (eventStart - leadMinutes).
 *   - The lead minutes default to 15 but the caller can override.
 *   - The notification ID returned can be passed back to cancelReminder().
 *
 * The expo-notifications native module is lazy-required at first call,
 * matching the pattern used by react-native-app-auth and expo-contacts
 * in src/services/bootstrap.ts. If the module fails to bind on a
 * particular OEM Android variant, only the notification feature
 * degrades — the rest of the app keeps working.
 */

import { type CalendarEvent } from '../types/tools';
import { NexusError, type Result, err, ok } from '../types/auth';
import { logEvent, logError } from '../utils/logger';

interface NotificationsModule {
  setNotificationHandler: (h: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }) => void;
  getPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  scheduleNotificationAsync: (input: {
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: { date: Date } | null;
  }) => Promise<string>;
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  getAllScheduledNotificationsAsync: () => Promise<readonly { identifier: string }[]>;
}

const isNotificationsModule = (m: unknown): m is NotificationsModule =>
  typeof m === 'object' &&
  m !== null &&
  typeof (m as Record<string, unknown>).requestPermissionsAsync === 'function' &&
  typeof (m as Record<string, unknown>).scheduleNotificationAsync === 'function' &&
  typeof (m as Record<string, unknown>).cancelScheduledNotificationAsync === 'function';

let cachedHandlerInstalled = false;

const lazyNotifications = (): Result<NotificationsModule, NexusError> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as unknown;
    if (!isNotificationsModule(mod)) {
      return err(
        new NexusError(
          'PROVIDER_ERROR',
          'expo-notifications module shape is unexpected.',
          { isRetryable: false },
        ),
      );
    }
    if (!cachedHandlerInstalled) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      cachedHandlerInstalled = true;
    }
    return ok(mod);
  } catch (cause) {
    return err(
      new NexusError(
        'PROVIDER_ERROR',
        'expo-notifications could not be loaded on this device.',
        { isRetryable: false, cause },
      ),
    );
  }
};

/** Ask the user for notification permission. Idempotent. */
export const requestPermission = async (): Promise<Result<boolean, NexusError>> => {
  const modResult = lazyNotifications();
  if (!modResult.ok) return err(modResult.error);
  try {
    const existing = await modResult.value.getPermissionsAsync();
    if (existing.granted) return ok(true);
    const requested = await modResult.value.requestPermissionsAsync();
    if (requested.granted) {
      logEvent('notifications_permission_granted', {});
      return ok(true);
    }
    logEvent('notifications_permission_denied', {});
    return ok(false);
  } catch (cause) {
    return err(
      new NexusError(
        'PERMISSION_DENIED',
        'failed to request notifications permission.',
        { isRetryable: false, cause },
      ),
    );
  }
};

/**
 * Schedule a reminder for a single calendar event. Returns the
 * scheduled notification id, which the caller can pass to
 * cancelReminder() if the event is later modified or deleted.
 */
export const scheduleEventReminder = async (
  event: CalendarEvent,
  leadMinutes: number = 15,
): Promise<Result<string, NexusError>> => {
  if (event.summary.trim().length === 0) {
    return err(new NexusError('INVALID_INPUT', 'event summary is required.'));
  }
  const startMs = Date.parse(event.startIso);
  if (Number.isNaN(startMs)) {
    return err(new NexusError('INVALID_INPUT', 'event start must be ISO 8601.'));
  }
  const triggerMs = startMs - Math.max(0, leadMinutes) * 60_000;
  if (triggerMs <= Date.now()) {
    return err(
      new NexusError(
        'INVALID_INPUT',
        'event reminder lead time is already in the past.',
      ),
    );
  }

  const modResult = lazyNotifications();
  if (!modResult.ok) return err(modResult.error);

  try {
    const id = await modResult.value.scheduleNotificationAsync({
      content: {
        title: `Upcoming: ${event.summary}`,
        body: `Starts in ${leadMinutes} minute${leadMinutes === 1 ? '' : 's'}.`,
        data: { eventId: event.id, calendarLink: event.htmlLink },
      },
      trigger: { date: new Date(triggerMs) },
    });
    logEvent('notifications_scheduled', {
      tool_name: 'calendar_reminder',
    });
    return ok(id);
  } catch (cause) {
    logError('notifications_schedule_failed', {});
    return err(
      new NexusError('PROVIDER_ERROR', 'failed to schedule notification.', {
        isRetryable: true,
        cause,
      }),
    );
  }
};

/** Cancel a single previously-scheduled reminder by id. */
export const cancelReminder = async (
  notificationId: string,
): Promise<Result<void, NexusError>> => {
  const modResult = lazyNotifications();
  if (!modResult.ok) return err(modResult.error);
  try {
    await modResult.value.cancelScheduledNotificationAsync(notificationId);
    return ok(undefined);
  } catch (cause) {
    return err(
      new NexusError('PROVIDER_ERROR', 'failed to cancel notification.', {
        isRetryable: true,
        cause,
      }),
    );
  }
};

/** Cancel every scheduled notification — used by Settings → factory reset. */
export const cancelAllReminders = async (): Promise<Result<void, NexusError>> => {
  const modResult = lazyNotifications();
  if (!modResult.ok) return err(modResult.error);
  try {
    await modResult.value.cancelAllScheduledNotificationsAsync();
    logEvent('notifications_all_cancelled', {});
    return ok(undefined);
  } catch (cause) {
    return err(
      new NexusError('PROVIDER_ERROR', 'failed to cancel all notifications.', {
        isRetryable: true,
        cause,
      }),
    );
  }
};

/** List all scheduled-notification identifiers (used for diagnostics). */
export const listScheduled = async (): Promise<Result<string[], NexusError>> => {
  const modResult = lazyNotifications();
  if (!modResult.ok) return err(modResult.error);
  try {
    const all = await modResult.value.getAllScheduledNotificationsAsync();
    return ok(all.map((n) => n.identifier));
  } catch (cause) {
    return err(
      new NexusError('PROVIDER_ERROR', 'failed to list notifications.', {
        isRetryable: true,
        cause,
      }),
    );
  }
};
