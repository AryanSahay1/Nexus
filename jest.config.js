/**
 * Jest config for Project Nexus.
 *
 * The full app uses `jest-expo` to handle Reanimated, expo-router, and Metro
 * transforms. For pure-TypeScript unit tests of the service layer (which
 * never touch React Native components), we use `ts-jest` directly so the
 * test suite runs without a full Expo native module chain.
 *
 * RN-component tests should live alongside their components and opt into
 * the `jest-expo` preset via per-file `// @jest-environment` directives or
 * a separate `jest.config.rn.js` if the matrix grows.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/unit/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@tests/(.*)$': '<rootDir>/__tests__/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  clearMocks: true,
};
