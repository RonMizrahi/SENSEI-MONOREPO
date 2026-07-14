// Flat ESLint config. Scoped to catch real correctness bugs (hooks rules,
// unreachable/duplicate code, unsafe comparisons) rather than style. The port
// originates from an untyped prototype, so `any` and inline styles are allowed;
// tightening those is tracked debt (see README).
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  // Build output, deps, static assets, and the design-sync tooling/artifacts
  // (converter scripts + generated bundle — all gitignored, never app source).
  { ignores: ['dist', 'node_modules', 'public', 'ds-bundle', '.ds-sync', '.design-sync'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The port is intentionally untyped in places; these are deferred debt,
      // not production blockers.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // real-bug rules stay at error:
      'no-constant-condition': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-self-compare': 'error',
      semi: ['error', 'always'],
    },
  },
  // tests use node/jsdom globals
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly' } },
  },
)
