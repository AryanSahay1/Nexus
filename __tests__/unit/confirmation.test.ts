/**
 * Unit tests for src/hooks/useConfirmation.ts (the module-level Promise
 * resolver pair the agent loop awaits).
 */

import {
  __resetConfirmationForTests,
  awaitConfirmationGlobal,
  cancelGlobal,
  confirmGlobal,
} from '../../src/hooks/useConfirmation';

beforeEach(() => {
  __resetConfirmationForTests();
});

describe('confirmation gate', () => {
  it('confirm resolves the awaiting promise with confirmed=true', async () => {
    const p = awaitConfirmationGlobal();
    confirmGlobal();
    const decision = await p;
    expect(decision).toEqual({ confirmed: true });
  });

  it('cancel resolves the awaiting promise with confirmed=false', async () => {
    const p = awaitConfirmationGlobal();
    cancelGlobal();
    const decision = await p;
    expect(decision).toEqual({ confirmed: false });
  });

  it('confirm/cancel without a pending await is a noop (does not throw)', () => {
    expect(() => confirmGlobal()).not.toThrow();
    expect(() => cancelGlobal()).not.toThrow();
  });

  it('a fresh awaitConfirmation while one is pending resolves the previous as cancelled', async () => {
    const p1 = awaitConfirmationGlobal();
    const p2 = awaitConfirmationGlobal();
    expect(await p1).toEqual({ confirmed: false });
    confirmGlobal();
    expect(await p2).toEqual({ confirmed: true });
  });

  it('the same resolver is consumed only once (subsequent confirm is noop)', async () => {
    const p = awaitConfirmationGlobal();
    confirmGlobal();
    expect(await p).toEqual({ confirmed: true });
    expect(() => confirmGlobal()).not.toThrow();
    expect(() => cancelGlobal()).not.toThrow();
  });
});
