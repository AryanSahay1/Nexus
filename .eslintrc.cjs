module.exports = {
  root: true,
  extends: [
    'expo',
    'prettier',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['/dist/*', 'node_modules/', 'babel.config.js', 'metro.config.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true, allowTypedFunctionExpressions: true },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // jest.mock() factories must be hoisted before the imports they
      // shadow (Babel hoists them automatically), so `import/first` is
      // noise inside test files.
      files: ['__tests__/**/*.ts', '__tests__/**/*.tsx', 'e2e/**/*.ts'],
      rules: {
        'import/first': 'off',
      },
    },
  ],
};
