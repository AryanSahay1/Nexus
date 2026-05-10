/**
 * Tour step factories — every tour the app ships, in one place.
 *
 * Screens import these factories, supply their own refs, and pass the
 * result to `useTour(tourId, steps)`. Centralising the copy here keeps
 * the strings out of JSX (where they would scatter) and makes it
 * trivial to translate or re-tone the whole tour catalogue.
 */

import type { RefObject } from 'react';
import type { View } from 'react-native';

import type { TourStep } from './types';

type Ref = RefObject<View | null>;

// ── Vault ───────────────────────────────────────────────────────────

export const buildVaultOpenAiSetupSteps = (refs: {
  card: Ref;
  input: Ref;
  saveButton: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.card,
    title: 'Add your OpenAI key',
    description:
      'Nexus uses OpenAI to power your AI agent. Your key is stored only on this device.',
    actionHint: 'Tap the card below to expand it ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.input,
    title: 'Paste your key here',
    description:
      'Get your key from platform.openai.com/api-keys. It starts with sk-',
    actionHint: 'Paste your OpenAI API key ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.saveButton,
    title: 'Save your key',
    description:
      "Your key is encrypted and stored securely using your device's secure enclave.",
    actionHint: 'Tap Save to continue →',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];

export const buildVaultGoogleConnectSteps = (refs: {
  card: Ref;
  connectButton: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.card,
    title: 'Connect Google',
    description:
      'Connect Google to let Nexus read your Gmail, Calendar, and Drive.',
    actionHint: 'Tap Connect Google below ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.connectButton,
    title: 'Start Google sign-in',
    description:
      'A browser will open. Sign in with your Google account and approve the permissions.',
    actionHint: 'Tap this button to open Google sign-in →',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];

// ── Chat ────────────────────────────────────────────────────────────

export const buildChatFirstMessageSteps = (refs: {
  inputBar: Ref;
  typingIndicator: Ref;
  firstAssistantBubble: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.inputBar,
    title: 'Talk to your agent',
    description:
      'Type anything — ask Nexus to send an email, check your calendar, or find a contact.',
    actionHint: 'Tap here and type your first message ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.typingIndicator,
    title: 'Nexus is thinking',
    description:
      'Your agent is processing your request. It may use tools like Gmail or Calendar.',
    actionHint: 'Wait for the response…',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.firstAssistantBubble,
    title: 'Your agent responded',
    description:
      'Nexus can take actions on your behalf. Try asking it to send an email.',
    actionHint: 'Read the response, then try another message →',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
];

export const buildChatConfirmActionSteps = (refs: {
  summary: Ref;
  confirmButton: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.summary,
    title: 'Review before sending',
    description:
      "Nexus always shows you exactly what it's about to do before doing it.",
    actionHint: 'Read the action summary above ↑',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.confirmButton,
    title: 'Confirm or cancel',
    description:
      'Tap Confirm to let Nexus proceed, or Cancel to stop the action.',
    actionHint: 'Choose Confirm or Cancel →',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];

// ── Mail ────────────────────────────────────────────────────────────

export const buildMailFirstOpenSteps = (refs: {
  list: Ref;
  firstRow: Ref;
  pullToRefresh: Ref;
  chatTab: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.list,
    title: 'Your Gmail inbox',
    description: 'These are your real emails pulled live from Gmail.',
    actionHint: 'Scroll through your inbox ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'auto',
  },
  {
    targetRef: refs.firstRow,
    title: 'Open an email',
    description: 'Tap any email to read the full message.',
    actionHint: 'Tap an email to open it ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.pullToRefresh,
    title: 'Refresh your inbox',
    description: 'Pull down to load the latest emails from Gmail.',
    actionHint: 'Pull down to refresh ↑',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.chatTab,
    title: 'Ask your agent about emails',
    description:
      "Switch to Chat and ask: 'Read my latest email' or 'Send an email to [name]'.",
    actionHint: 'Tap Chat to try it →',
    spotlightShape: 'circle',
    tooltipPosition: 'above',
  },
];

export const buildMailSendViaAgentSteps = (refs: {
  recipient: Ref;
  subjectAndBody: Ref;
  confirmButton: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.recipient,
    title: 'Check the recipient',
    description:
      "Nexus found this email address from your message. Make sure it's correct.",
    actionHint: 'Verify the recipient ↑',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.subjectAndBody,
    title: 'Review the email content',
    description:
      'This is exactly what Nexus will send. You can cancel and ask it to change anything.',
    actionHint: 'Read the full email above ↑',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.confirmButton,
    title: 'Send or cancel',
    description:
      'Tap Confirm to send, or Cancel to go back and adjust your request.',
    actionHint: 'Tap Confirm to send the email →',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];

// ── Calendar ────────────────────────────────────────────────────────

export const buildCalendarFirstOpenSteps = (refs: {
  rangeChips: Ref;
  firstEvent: Ref;
  chatTab: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.rangeChips,
    title: 'Filter your events',
    description:
      'Switch between Today, This week, and 2 weeks to see different date ranges.',
    actionHint: 'Tap a range chip to filter ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.firstEvent,
    title: 'Your real events',
    description:
      'These are live from your Google Calendar. Long-press any event to set a reminder.',
    actionHint: 'Long-press an event to set a reminder ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.chatTab,
    title: 'Ask your agent about your calendar',
    description:
      "Switch to Chat and ask: 'What's on my calendar today?' or 'Schedule a meeting with [name] tomorrow at 3pm'.",
    actionHint: 'Tap Chat to try it →',
    spotlightShape: 'circle',
    tooltipPosition: 'above',
  },
];

export const buildCalendarCreateViaAgentSteps = (refs: {
  eventTitle: Ref;
  confirmButton: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.eventTitle,
    title: 'Review the event details',
    description:
      'Check the title, time, and attendees before adding to your calendar.',
    actionHint: 'Read the event details above ↑',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.confirmButton,
    title: 'Add to Calendar',
    description:
      'Tap Confirm to create the event in Google Calendar, or Cancel to adjust.',
    actionHint: 'Tap Confirm to add the event →',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];

// ── Memory + Settings ──────────────────────────────────────────────

export const buildMemoryFirstOpenSteps = (refs: {
  statTiles: Ref;
  addFactKeyInput: Ref;
  chatTab: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.statTiles,
    title: "Your agent's memory",
    description:
      'Nexus remembers facts you tell it and your conversation history.',
    actionHint: 'See what Nexus remembers ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.addFactKeyInput,
    title: 'Teach Nexus something',
    description:
      'Tell Nexus facts about you. It uses these in every conversation.',
    actionHint: "Type a fact key, e.g. 'My name' ↓",
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.chatTab,
    title: 'Use your memory in Chat',
    description:
      "Switch to Chat and ask: 'What do you know about me?' to see it in action.",
    actionHint: 'Tap Chat to try it →',
    spotlightShape: 'circle',
    tooltipPosition: 'above',
  },
];

export const buildSettingsFirstOpenSteps = (refs: {
  providerChips: Ref;
  temperatureStepper: Ref;
  factoryReset: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.providerChips,
    title: 'Choose your AI provider',
    description:
      'Switch between OpenAI and Groq with one tap. Groq is faster and cheaper.',
    actionHint: 'Tap a provider to switch ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.temperatureStepper,
    title: 'Adjust creativity',
    description:
      'Lower = more precise answers. Higher = more creative responses.',
    actionHint: 'Use + and - to adjust ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'below',
  },
  {
    targetRef: refs.factoryReset,
    title: 'Reset if needed',
    description:
      'This clears all keys, connections, and memory. Only use if something is wrong.',
    actionHint: 'Leave this alone for now ↓',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];

// ── Voice input ─────────────────────────────────────────────────────

export const buildVoiceFirstUseSteps = (refs: {
  micIdle: Ref;
  micRecording: Ref;
  inputWithTranscript: Ref;
}): readonly TourStep[] => [
  {
    targetRef: refs.micIdle,
    title: 'Voice input',
    description:
      'Tap and hold to record. Release to send your voice message to Nexus.',
    actionHint: 'Tap the mic to start recording ↓',
    spotlightShape: 'circle',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.micRecording,
    title: 'Recording…',
    description:
      'Speak clearly. Nexus will transcribe your voice and fill the input bar.',
    actionHint: 'Tap the mic again to stop recording ●',
    spotlightShape: 'circle',
    tooltipPosition: 'above',
  },
  {
    targetRef: refs.inputWithTranscript,
    title: 'Your message is ready',
    description:
      'Nexus transcribed your voice. Edit it if needed, then tap Send.',
    actionHint: 'Tap Send to submit your message →',
    spotlightShape: 'rect',
    tooltipPosition: 'above',
  },
];
