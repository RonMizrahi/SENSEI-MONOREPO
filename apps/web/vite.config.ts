/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

export default defineConfig({
  plugins: [react()],
  // Build-time version constant (from package.json — the CI-guarded single
  // source). Used for the one-line boot log so stale-client reports can be
  // correlated with a release. Non-PII.
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Default 3110; a harness-assigned PORT (preview tooling) wins, and without
  // strictPort a second session auto-increments instead of failing to start.
  server: { port: Number(process.env.PORT) || 3110 },
  preview: { port: 3110 },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    globals: true,
    css: false,
    // Playwright e2e (e2e/*.e2e.ts) runs via `npm run e2e`, never under vitest.
    // Never run tests from Claude Code session worktrees copied under .claude/.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      // Focus coverage on the logic that unit/regression tests target — the
      // pure utils, store, hooks, nav, data, and the API service layer
      // (contract-critical). Presentational pages are exercised by the route
      // smoke + a11y suites, not line-covered here.
      include: ['src/utils/**', 'src/store/**', 'src/hooks/**', 'src/nav/**', 'src/data/**', 'src/services/**'],
      // Ratcheted 2026-07-19 from 75 to just under measured coverage
      // (81.5/82.0/77.7/81.5) so a coverage regression fails CI while leaving
      // ~1.5% headroom for normal refactoring. Raise again when coverage grows.
      thresholds: { statements: 80, branches: 80, functions: 76, lines: 80 },
    },
  },
});
