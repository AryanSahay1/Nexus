/**
 * FLOW 4 — destructiveTool.e2e.ts
 *
 * Asks the agent to send an email. The ConfirmationSheet appears before
 * the network call. We exercise both the Cancel and Confirm paths.
 *
 * `MOCK_GMAIL_SEND_OK` makes the gmail_send tool resolve successfully
 * without hitting Google's API.
 */

import { by, device, element, expect, waitFor } from 'detox';

import '../init';

const RECIPIENT = 'friend@example.com';

describe('Destructive tool — confirmation gate (Gmail send)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        MOCK_AGENT_TOOL_CALL: 'gmail_send',
        MOCK_GMAIL_SEND_OK: 'true',
      },
    });
    await element(by.id('tab-chat')).tap();
  });

  it('Cancel — the ConfirmationSheet appears and Cancel does not send', async () => {
    await element(by.id('chat-input')).typeText(`Email ${RECIPIENT} a hello`);
    await element(by.id('chat-send')).tap();

    await waitFor(element(by.id('confirmation-sheet')))
      .toBeVisible()
      .withTimeout(15_000);
    await expect(element(by.text(RECIPIENT))).toBeVisible();

    await element(by.id('confirmation-cancel')).tap();
    await expect(element(by.id('confirmation-sheet'))).not.toBeVisible();
    // No "sent" affordance should appear in chat.
    await expect(element(by.text(/✓ Sent to/i))).not.toBeVisible();
  });

  it('Confirm — re-asking the agent and tapping Confirm sends the email', async () => {
    await element(by.id('chat-input')).typeText(`Try again — email ${RECIPIENT}`);
    await element(by.id('chat-send')).tap();

    await waitFor(element(by.id('confirmation-sheet')))
      .toBeVisible()
      .withTimeout(15_000);
    await element(by.id('confirmation-confirm')).tap();

    await expect(element(by.id('confirmation-sheet'))).not.toBeVisible();
    await waitFor(element(by.text(/Sent/i)))
      .toBeVisible()
      .withTimeout(15_000);
  });
});
