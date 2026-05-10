/**
 * FLOW 1 — onboarding.e2e.ts
 *
 * App launches to the Vault tab when no API key is configured. The user
 * pastes a key, the Vault row flips to "Connected", and the user — not
 * the app — controls navigation away from Vault.
 */

import { by, device, element, expect } from 'detox';

import '../init';

const VALID_OPENAI_KEY = 'sk-test-onboardingfixture-1234567890ab';

describe('Onboarding — first launch lands on Vault and accepts an API key', () => {
  beforeAll(async () => {
    await device.uninstallApp();
    await device.installApp();
    await device.launchApp({ newInstance: true, delete: true });
  });

  it('lands on the Vault tab when no API key is configured', async () => {
    await expect(element(by.id('tab-vault'))).toBeVisible();
    await expect(element(by.id('vault-screen'))).toBeVisible();
  });

  it('accepts a valid OpenAI API key and shows Connected', async () => {
    await element(by.id('vault-openai-input')).typeText(VALID_OPENAI_KEY);
    await element(by.id('vault-openai-save')).tap();

    await expect(element(by.id('vault-openai-status-connected'))).toBeVisible();
    await expect(element(by.text('Connected'))).toBeVisible();
  });

  it('does not auto-navigate away from Vault — the user controls navigation', async () => {
    // After save, the Vault tab should still be the active tab. We assert
    // that explicitly: no auto-jump to Chat / Mail / Memory.
    await expect(element(by.id('vault-screen'))).toBeVisible();
    await expect(element(by.id('chat-screen'))).not.toBeVisible();
  });
});
