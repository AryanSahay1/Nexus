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
      // Jest mock factories MUST be hoisted before the imports they shadow
      // (jest.mock() is jest-hoisted by Babel anyway), so `import/first`
      // and the unused-expression rules are off-limits noise in test files.
      files: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
      rules: {
        'import/first': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
};
