/**
 * Unit tests for src/services/notificationService.ts.
 *
 * The expo-notifications native module is mocked at the require()-path
 * the service uses for lazy loading.
 */

const scheduleMock = jest.fn(async () => 'notif_id_1');
const cancelMock = jest.fn(async () => undefined);
const cancelAllMock = jest.fn(async () => undefined);
const getPermsMock = jest.fn(async () => ({ granted: false }));
const reqPermsMock = jest.fn(async () => ({ granted: true }));
const listAllMock = jest.fn(async () => [
  { identifier: 'a' },
  { identifier: 'b' },
]);
const setHandlerMock = jest.fn();

jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: setHandlerMock,
  getPermissionsAsync: getPermsMock,
  requestPermissionsAsync: reqPermsMock,
  scheduleNotificationAsync: scheduleMock,
  cancelScheduledNotificationAsync: cancelMock,
  cancelAllScheduledNotificationsAsync: cancelAllMock,
  getAllScheduledNotificationsAsync: listAllMock,
}));

// eslint-disable-next-line import/first
import * as notificationService from '../../src/services/notificationService';
// eslint-disable-next-line import/first
import { type CalendarEvent } from '../../src/types/tools';

beforeEach(() => {
  jest.clearAllMocks();
  getPermsMock.mockResolvedValue({ granted: false });
  reqPermsMock.mockResolvedValue({ granted: true });
});

const buildEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'evt_1',
  summary: 'Sync',
  startIso: new Date(Date.now() + 60 * 60_000).toISOString(),
  endIso: new Date(Date.now() + 90 * 60_000).toISOString(),
  htmlLink: null,
  ...overrides,
});

describe('requestPermission', () => {
  it('returns true when permission is already granted (no prompt re-asked)', async () => {
    getPermsMock.mockResolvedValueOnce({ granted: true });
    const r = await notificationService.requestPermission();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(true);
    expect(reqPermsMock).not.toHaveBeenCalled();
  });

  it('prompts when not yet granted, returns true on grant', async () => {
    getPermsMock.mockResolvedValueOnce({ granted: false });
    reqPermsMock.mockResolvedValueOnce({ granted: true });
    const r = await notificationService.requestPermission();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(true);
    expect(reqPermsMock).toHaveBeenCalled();
  });

  it('returns false (not Err) when the user denies', async () => {
    getPermsMock.mockResolvedValueOnce({ granted: false });
    reqPermsMock.mockResolvedValueOnce({ granted: false });
    const r = await notificationService.requestPermission();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(false);
  });

  it('returns Err on a native rejection', async () => {
    reqPermsMock.mockRejectedValueOnce(new Error('native error'));
    const r = await notificationService.requestPermission();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PERMISSION_DENIED');
  });
});

describe('scheduleEventReminder', () => {
  it('rejects events without a summary', async () => {
    const r = await notificationService.scheduleEventReminder(
      buildEvent({ summary: '   ' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_INPUT');
  });

  it('rejects when the trigger time is already in the past', async () => {
    const r = await notificationService.scheduleEventReminder(
      buildEvent({ startIso: new Date(Date.now() - 60_000).toISOString() }),
      15,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_INPUT');
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('rejects malformed startIso', async () => {
    const r = await notificationService.scheduleEventReminder(
      buildEvent({ startIso: 'not-a-date' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_INPUT');
  });

  it('schedules the notification with the canonical content shape', async () => {
    const event = buildEvent({ summary: 'Standup', startIso: new Date(Date.now() + 60 * 60_000).toISOString() });
    const r = await notificationService.scheduleEventReminder(event, 15);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('notif_id_1');
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const firstCall = scheduleMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall) {
      const arg = (firstCall as unknown as readonly unknown[])[0] as {
        content: { title: string; body: string };
        trigger: { date: Date };
      };
      expect(arg.content.title).toContain('Standup');
      expect(arg.content.body).toContain('15 minute');
      expect(arg.trigger.date).toBeInstanceOf(Date);
    }
  });

  it('returns Err with code PROVIDER_ERROR on native rejection', async () => {
    scheduleMock.mockRejectedValueOnce(new Error('storage full'));
    const r = await notificationService.scheduleEventReminder(buildEvent(), 15);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PROVIDER_ERROR');
  });
});

describe('cancelReminder + cancelAllReminders + listScheduled', () => {
  it('cancelReminder calls the native cancel', async () => {
    const r = await notificationService.cancelReminder('notif_xyz');
    expect(r.ok).toBe(true);
    expect(cancelMock).toHaveBeenCalledWith('notif_xyz');
  });

  it('cancelAllReminders clears every scheduled notification', async () => {
    const r = await notificationService.cancelAllReminders();
    expect(r.ok).toBe(true);
    expect(cancelAllMock).toHaveBeenCalled();
  });

  it('listScheduled returns identifier strings', async () => {
    const r = await notificationService.listScheduled();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(['a', 'b']);
  });
});
