/**
 * FLOW 6 — calendar.e2e.ts
 *
 * Calendar tab loads today's events, range chip ("This week") swaps the
 * source, long-press an event schedules a notification reminder, and a
 * confirmation toast appears.
 */

import { by, device, element, expect, waitFor } from 'detox';

import '../init';

describe('Calendar tab — events, range filter, reminder', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        OAUTH_FAKE_BACKEND: 'jane@example.com',
        MOCK_CALENDAR_EVENTS: 'true',
      },
    });
    await element(by.id('tab-calendar')).tap();
  });

  it('loads "Today" events on first paint', async () => {
    await waitFor(element(by.id('calendar-list')))
      .toBeVisible()
      .withTimeout(15_000);
    await expect(element(by.id('calendar-range-today'))).toBeVisible();
    await expect(element(by.id('calendar-event-0'))).toBeVisible();
  });

  it('switches to "This week" via the range chip', async () => {
    await element(by.id('calendar-range-week')).tap();
    await waitFor(element(by.id('calendar-event-0')))
      .toBeVisible()
      .withTimeout(15_000);
    // The week-range fixture is wider than the day-range fixture.
    await expect(element(by.id('calendar-event-3'))).toBeVisible();
  });

  it('schedules a reminder when an event is long-pressed', async () => {
    await element(by.id('calendar-event-0')).longPress();
    await waitFor(element(by.id('reminder-toast')))
      .toBeVisible()
      .withTimeout(5_000);
    await expect(element(by.text(/reminder scheduled/i))).toBeVisible();
  });
});
