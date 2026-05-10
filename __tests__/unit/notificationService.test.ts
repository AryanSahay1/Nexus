/**
 * Unit tests for src/services/notificationService.ts (v1.0.2 stub).
 *
 * v1.0.2 temporarily disables expo-notifications to isolate it as a
 * potential cause of the Vivo V27 immediate-close. When v1.0.2 ships
 * and the user reports back, we either re-add expo-notifications
 * (controlled re-introduction) or we eliminate it as the cause and
 * move on. These tests pin the stubbed contract.
 */

import { type CalendarEvent } from '../../src/types/tools';
import * as notificationService from '../../src/services/notificationService';

const buildEvent = (): CalendarEvent => ({
  id: 'evt_1',
  summary: 'Sync',
  startIso: new Date(Date.now() + 60 * 60_000).toISOString(),
  endIso: new Date(Date.now() + 90 * 60_000).toISOString(),
  htmlLink: null,
});

describe('notificationService (v1.0.2 stub)', () => {
  it('requestPermission resolves Ok(false) — never prompts native', async () => {
    const r = await notificationService.requestPermission();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(false);
  });

  it('scheduleEventReminder returns Err with PROVIDER_ERROR + isRetryable=false', async () => {
    const r = await notificationService.scheduleEventReminder(buildEvent(), 15);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('PROVIDER_ERROR');
      expect(r.error.isRetryable).toBe(false);
      expect(r.error.message).toContain('temporarily disabled');
    }
  });

  it('cancelReminder returns the same Err shape', async () => {
    const r = await notificationService.cancelReminder('any');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PROVIDER_ERROR');
  });

  it('cancelAllReminders returns the same Err shape', async () => {
    const r = await notificationService.cancelAllReminders();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PROVIDER_ERROR');
  });

  it('listScheduled returns Ok with an empty array', async () => {
    const r = await notificationService.listScheduled();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });

  it('Err message names this build so support can identify it', async () => {
    const r = await notificationService.scheduleEventReminder(buildEvent());
    if (!r.ok) expect(r.error.message).toMatch(/v1\.0\.2/);
  });
});
