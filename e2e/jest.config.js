/**
 * Jest config for the Detox e2e suite.
 *
 * Runs in `node` (Detox manages its own runtime), TypeScript via ts-jest,
 * and only matches files under `e2e/flows/`. Kept separate from the unit
 * test runner so `npx jest` in CI never tries to drive a real device.
 */
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/flows/**/*.e2e.ts'],
  testTimeout: 120_000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.test.json', isolatedModules: true },
    ],
  },
};
