/**
 * Per-suite setup hook for Detox flows.
 *
 * Detox's globalSetup launches the AVD; this file installs the
 * before/after hooks that every individual flow inherits. Tests
 * import the named exports they need (`device`, `element`, `by`,
 * `expect`) directly from 'detox'.
 */

import { device } from 'detox';

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: { notifications: 'YES', microphone: 'YES', contacts: 'YES' },
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});
