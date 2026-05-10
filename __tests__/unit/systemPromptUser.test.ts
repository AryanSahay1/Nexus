/**
 * Targeted tests for the new optional-user injection in
 * src/agent/systemPrompt.ts. The pre-existing systemPrompt tests in
 * agent.test.ts continue to cover the deterministic / preferences /
 * connections paths.
 */

jest.mock('react-native-reanimated', () => ({
  Easing: { bezier: () => () => 0, inOut: () => 0, ease: 0 },
}));

// eslint-disable-next-line import/first
import { build } from '../../src/agent/systemPrompt';

describe('systemPrompt.build (optional user identity)', () => {
  const baseInput = {
    now: new Date('2030-06-15T10:00:00.000Z'),
    timezone: 'Asia/Kolkata',
    preferences: {},
    connectedProviders: [],
  };

  it('omits the User identity block when user is undefined', () => {
    const out = build(baseInput);
    expect(out).not.toContain('User identity:');
  });

  it('omits the User identity block when user is supplied with null fields', () => {
    const out = build({
      ...baseInput,
      user: { email: null, displayName: null },
    });
    expect(out).not.toContain('User identity:');
  });

  it('includes only the email line when only email is present', () => {
    const out = build({
      ...baseInput,
      user: { email: 'alice@example.com', displayName: null },
    });
    expect(out).toContain('User identity:');
    expect(out).toContain('Email: alice@example.com');
    expect(out).not.toContain('Name: ');
  });

  it('includes both Name and Email when both are present', () => {
    const out = build({
      ...baseInput,
      user: { email: 'alice@example.com', displayName: 'Alice Doe' },
    });
    expect(out).toContain('Name: Alice Doe');
    expect(out).toContain('Email: alice@example.com');
  });

  it('is deterministic for fixed inputs including the user', () => {
    const a = build({
      ...baseInput,
      user: { email: 'alice@example.com', displayName: 'Alice Doe' },
    });
    const b = build({
      ...baseInput,
      user: { email: 'alice@example.com', displayName: 'Alice Doe' },
    });
    expect(a).toBe(b);
  });
});
