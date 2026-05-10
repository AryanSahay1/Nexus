/**
 * FLOW 3 — chat.e2e.ts
 *
 * Send a message → see the typing indicator → see the agent's reply
 * → list scrolls to the latest message → close + reopen → history is
 * still visible.
 *
 * The agent loop is wired against a `MOCK_AGENT_RESPONSE` launch arg
 * so we get a deterministic reply without a real OpenAI call.
 */

import { by, device, element, expect, waitFor } from 'detox';

import '../init';

const USER_PROMPT = 'What is on my calendar tomorrow?';
const AGENT_REPLY = 'You have one event tomorrow at 10:00 AM.';

describe('Chat — send, typing indicator, reply, persistence', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { MOCK_AGENT_RESPONSE: AGENT_REPLY },
    });
    await element(by.id('tab-chat')).tap();
  });

  it('shows the typing indicator after Send and reveals the agent reply', async () => {
    await element(by.id('chat-input')).typeText(USER_PROMPT);
    await element(by.id('chat-send')).tap();

    await expect(element(by.id('typing-indicator'))).toBeVisible();
    await waitFor(element(by.text(AGENT_REPLY)))
      .toBeVisible()
      .withTimeout(20_000);
    await expect(element(by.id('typing-indicator'))).not.toBeVisible();
  });

  it('scrolls the message list to the latest message', async () => {
    // The latest assistant bubble must be in view (not just rendered
    // somewhere off-screen).
    await expect(element(by.text(AGENT_REPLY))).toBeVisible();
  });

  it('persists chat history across an app restart', async () => {
    await device.terminateApp();
    await device.launchApp({ newInstance: false });

    await element(by.id('tab-chat')).tap();
    await expect(element(by.text(USER_PROMPT))).toBeVisible();
    await expect(element(by.text(AGENT_REPLY))).toBeVisible();
  });
});
