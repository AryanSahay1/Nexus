/**
 * FLOW 2 — googleAuth.e2e.ts
 *
 * "Connect Google" launches the OAuth flow. After successful auth Vault
 * shows the user's email, and a backgrounded-then-reopened app preserves
 * the session (no re-login).
 *
 * The actual OAuth browser is mocked at the native level via the
 * `OAUTH_FAKE_BACKEND` launch arg — Detox can't drive Chrome Custom
 * Tabs in CI. The fake backend returns a canned authorize / refresh
 * pair so the flow can assert on the persisted state, not the chrome.
 */

import { by, device, element, expect } from 'detox';

import '../init';

describe('Google OAuth — connect, persist, survive backgrounding', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { OAUTH_FAKE_BACKEND: 'jane@example.com' },
    });
  });

  it('shows the OAuth modal when Connect Google is tapped', async () => {
    await element(by.id('tab-vault')).tap();
    await element(by.id('vault-google-connect')).tap();
    await expect(element(by.id('oauth-modal'))).toBeVisible();
  });

  it('persists the session and shows the connected email', async () => {
    // The fake backend resolves the authorize call automatically; the
    // modal closes and Vault flips to connected.
    await expect(element(by.id('vault-google-status-connected'))).toBeVisible();
    await expect(element(by.text('jane@example.com'))).toBeVisible();
  });

  it('survives backgrounding without requiring a re-login', async () => {
    await device.sendToHome();
    await device.launchApp({ newInstance: false });

    await expect(element(by.id('vault-google-status-connected'))).toBeVisible();
    await expect(element(by.text('jane@example.com'))).toBeVisible();
    await expect(element(by.id('vault-google-connect'))).not.toBeVisible();
  });
});
