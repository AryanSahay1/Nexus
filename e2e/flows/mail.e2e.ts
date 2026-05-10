/**
 * FLOW 5 — mail.e2e.ts
 *
 * Mail tab loads inbox, tapping a row opens the detail view, pull-to-
 * refresh re-fetches. Requires the Google account to be connected (the
 * suite's beforeAll uses the same fake-OAuth launch arg as Flow 2).
 */

import { by, device, element, expect, waitFor } from 'detox';

import '../init';

describe('Mail tab — inbox, detail, pull-to-refresh', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        OAUTH_FAKE_BACKEND: 'jane@example.com',
        MOCK_GMAIL_THREADS: 'true',
      },
    });
    await element(by.id('tab-mail')).tap();
  });

  it('loads the inbox with at least one email row', async () => {
    await waitFor(element(by.id('mail-list')))
      .toBeVisible()
      .withTimeout(15_000);
    await expect(element(by.id('mail-row-0'))).toBeVisible();
  });

  it('opens the email detail view on row tap', async () => {
    await element(by.id('mail-row-0')).tap();
    await expect(element(by.id('mail-detail'))).toBeVisible();
    await expect(element(by.id('mail-detail-body'))).toBeVisible();

    // Back to inbox so the pull-to-refresh test is unambiguous.
    await element(by.id('mail-detail-back')).tap();
    await expect(element(by.id('mail-list'))).toBeVisible();
  });

  it('reloads the inbox on pull-to-refresh', async () => {
    await element(by.id('mail-list')).swipe('down', 'fast', 0.7);
    await waitFor(element(by.id('mail-refresh-spinner')))
      .toBeVisible()
      .withTimeout(5_000);
    await waitFor(element(by.id('mail-refresh-spinner')))
      .not.toBeVisible()
      .withTimeout(15_000);
    await expect(element(by.id('mail-row-0'))).toBeVisible();
  });
});
