/* eslint-disable no-undef */
/**
 * Jest setup — runs once before each test file.
 *
 * - Forces a deterministic timezone so any date-string assertions are stable
 *   across CI machines (the tokenService expiry test parses ISO timestamps).
 * - Silences a noisy reanimated warning if any RN components are pulled in.
 */
process.env.TZ = 'UTC';
process.env.EXPO_PUBLIC_APP_ENV = 'test';
